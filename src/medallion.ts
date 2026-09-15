/**
 * Medallion builder: PinAnalysis → a THREE.Group coin.
 *
 * The body is the pin's own silhouette extruded with a bevel; the face is the
 * same silhouette carrying the artwork plus a derived normal map, so the gold
 * outline reads as raised metal and the enamel sits in shallow inlay.
 */
import * as THREE from "three";
import type { PinAnalysis } from "./analyze.js";
import { contourToPoints, simplify, traceContour } from "./trace.js";

export type MedalMetal = "gold" | "silver" | "bronze";

export type MedallionOptions = {
  /** Longest edge of the coin, in world units. */
  size?: number;
  /** Coin thickness. */
  thickness?: number;
  /** Bevel width; drives how much the rim catches the light. */
  bevel?: number;
  /** The struck metal: recolours the body and the artwork's gold paint. */
  metal?: MedalMetal;
  /** Normal-map strength for the embossed artwork. */
  relief?: number;
  envMap?: THREE.Texture | null;
  /** Trace the pin outline (true) or fall back to a circular coin (false). */
  silhouette?: boolean;
};

export type Medallion = {
  group: THREE.Group;
  body: THREE.Mesh;
  face: THREE.Mesh;
  /** Drop-in update when a new env map arrives. */
  setEnvironment(env: THREE.Texture | null): void;
  dispose(): void;
};

function colorTexture(face: Uint8ClampedArray, w: number, h: number): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array(face.buffer.slice(0)), w, h, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/** Pack roughness into G and metalness into B — the channels Three.js reads. */
function ormTexture(roughness: Uint8Array, metalness: Uint8Array, w: number, h: number): THREE.DataTexture {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = 255; // AO
    data[i * 4 + 1] = roughness[i];
    data[i * 4 + 2] = metalness[i];
    data[i * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Sobel the height field into a tangent-space normal map. */
function normalTexture(height: Uint8Array, w: number, h: number, strength: number): THREE.DataTexture {
  const data = new Uint8Array(w * h * 4);
  const sample = (x: number, y: number) =>
    height[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (sample(x - 1, y) - sample(x + 1, y)) * strength;
      const dy = (sample(x, y - 1) - sample(x, y + 1)) * strength;
      const nx = dx, ny = dy, nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      const o = (y * w + x) * 4;
      data[o] = ((nx / len) * 0.5 + 0.5) * 255;
      data[o + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      data[o + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      data[o + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Circle fallback so a failed trace still produces something solid. */
function circleShape(size: number): THREE.Shape {
  const r = size / 2;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, r, 0, Math.PI * 2, false);
  return shape;
}

export function createMedallion(analysis: PinAnalysis, options: MedallionOptions = {}): Medallion {
  const {
    size = 2,
    thickness = 0.12,
    bevel = 0.02,
    metal = "gold",
    relief = 2.0,
    envMap = null,
    silhouette = true,
  } = options;

  // Per-metal body colour and face tint. Tints multiply the pixel's own
  // luminance so the artwork's shading survives the recolour.
  const METALS: Record<MedalMetal, { body: number; tint: [number, number, number] }> = {
    gold: { body: 0xe9c46a, tint: [1.0, 0.92, 0.62] },
    silver: { body: 0xc9ccd1, tint: [0.88, 0.91, 0.96] },
    bronze: { body: 0xb0793f, tint: [0.78, 0.54, 0.32] },
  };
  const metalSpec = METALS[metal];

  const { mask, heightMap, metalness, roughness, face, width, height: imgH, bounds } = analysis;

  // --- outline ---
  let shape: THREE.Shape;
  let traced = 0;
  if (silhouette) {
    const contour = traceContour(mask, width, imgH);
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) || 1;
    // ~1px: tight enough that the polygon hides under the artwork's own gold
    // border, loose enough to collapse the pixel staircase — an exactly-traced
    // outline corrugates the extrusion wall into visible micro-facets.
    const epsilon = Math.max(1.0, span / 300);
    const points = contourToPoints(simplify(contour, epsilon), bounds, size);
    traced = points.length;
    shape = points.length >= 3
      ? new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, p.y)))
      : circleShape(size);
  } else {
    shape = circleShape(size);
  }

  // --- body ---
  // The rim is a real bevel: it catches the studio light the way a struck coin
  // does and keeps the extrusion readable from every angle. The bevel expands
  // the silhouette outward by `bevel`, so the body is inset by exactly that
  // amount first — the bevel crest then lands on the face outline instead of
  // ringing it, and the wall tracks the artwork edge all the way around
  // (sides, top and bottom alike).
  const bodyGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: bevel * 1.4,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 8,
    steps: 1,
  });
  bodyGeometry.computeBoundingBox();
  const box = bodyGeometry.boundingBox!;
  const offsetX = -(box.min.x + box.max.x) / 2;
  const offsetY = -(box.min.y + box.max.y) / 2;
  bodyGeometry.translate(offsetX, offsetY, -(box.min.z + box.max.z) / 2);
  // Inset enough that bevel + trace slack never poke past the face: scale by
  // (1 - 2·bevel/size) about the centre, i.e. bevelSize at the widest point and
  // proportionally less elsewhere. The face's own painted gold outline is wider
  // than that, so the sliver hides behind it even face-on.
  bodyGeometry.scale(1 - (2 * bevel) / size, 1 - (2 * bevel) / size, 1);
  const halfDepth = (box.max.z - box.min.z) / 2;

  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: metalSpec.body,
    metalness: 1,
    roughness: 0.28,
    envMap,
    envMapIntensity: 1.15,
    clearcoat: 0.35,
    clearcoatRoughness: 0.35,
  });

  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.castShadow = true;
  body.receiveShadow = true;

  // --- face ---
  const faceGeometry = new THREE.ShapeGeometry(shape, 8);
  faceGeometry.translate(offsetX, offsetY, halfDepth + 0.0015);

  // Map the artwork across the shape's own bounding box.
  const position = faceGeometry.getAttribute("position") as THREE.BufferAttribute;
  const uv = new Float32Array(position.count * 2);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) || 1;
  const scale = size / span;
  for (let i = 0; i < position.count; i++) {
    const wx = position.getX(i) - offsetX;
    const wy = position.getY(i) - offsetY;
    const px = wx / scale + cx;
    const py = -wy / scale + cy;
    // Sample the artwork by canvas pixel. The polygon spans the art's bounding
    // box, but the texture is the full canvas: mapping the box to [0,1] shrunk
    // the artwork inside the silhouette (to ~66% width on tall pins!) and let
    // the gold body show through the transparent margins as a huge border.
    uv[i * 2] = px / width;
    uv[i * 2 + 1] = py / imgH;
  }
  faceGeometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

  const faceRGBA = new Uint8ClampedArray(face);
  if (metal !== "gold") {
    // Recolour the struck metal — the border ring and the artwork's painted
    // gold — towards this tier's metal, keeping each pixel's own shading.
    const [tr, tg, tb] = metalSpec.tint;
    for (let i = 0; i < width * imgH; i++) {
      if (!analysis.goldMask[i] && !analysis.ring[i]) continue;
      const o = i * 4;
      const lum = (faceRGBA[o] * 0.3 + faceRGBA[o + 1] * 0.59 + faceRGBA[o + 2] * 0.11) / 255;
      const shade = 0.22 + lum * 0.95;
      faceRGBA[o] = Math.min(255, tr * 255 * shade);
      faceRGBA[o + 1] = Math.min(255, tg * 255 * shade);
      faceRGBA[o + 2] = Math.min(255, tb * 255 * shade);
    }
  }

  const map = colorTexture(faceRGBA, width, imgH);
  const normalMap = normalTexture(heightMap, width, imgH, relief);
  const orm = ormTexture(roughness, metalness, width, imgH);

  // The face is lit like the real object: the classifier's maps make the gold
  // outline metal (it sweeps studio reflections as the medal turns) and the
  // enamel a clear-coated dielectric, while the derived normal map embosses the
  // artwork. Tone mapping keeps the highlights from clipping to white, which is
  // what washed the artwork out in earlier attempts.
  const faceMaterial = new THREE.MeshPhysicalMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughnessMap: orm,
    metalnessMap: orm,
    metalness: 1,
    roughness: 1,
    envMap,
    envMapIntensity: 0.95,
    clearcoat: 0.5,
    clearcoatRoughness: 0.3,
    alphaTest: 0.5,
  });

  const faceMesh = new THREE.Mesh(faceGeometry, faceMaterial);
  faceMesh.position.z = 0.0005;

  const group = new THREE.Group();
  group.add(body, faceMesh);

  return {
    group,
    body,
    face: faceMesh,
    setEnvironment(env) {
      bodyMaterial.envMap = env;
      faceMaterial.envMap = env;
      bodyMaterial.needsUpdate = true;
      faceMaterial.needsUpdate = true;
    },
    dispose() {
      bodyGeometry.dispose();
      faceGeometry.dispose();
      bodyMaterial.dispose();
      faceMaterial.dispose();
      map.dispose();
      normalMap.dispose();
      orm.dispose();
    },
  };
}

export function summarise(analysis: PinAnalysis): string {
  return `traceable blob ${analysis.bounds.maxX - analysis.bounds.minX}×${analysis.bounds.maxY - analysis.bounds.minY}px, gold ${(analysis.goldRatio * 100).toFixed(0)}%`;
}
