/**
 * Medallion builder: PinAnalysis → a THREE.Group coin.
 *
 * The body is the pin's own silhouette extruded with a bevel; the face is the
 * same silhouette carrying the artwork plus a derived normal map, so the gold
 * outline reads as raised metal and the enamel sits in shallow inlay.
 */
import * as THREE from "three";
import type { PinAnalysis } from "./analyze.js";
import { contourToPoints, simplify, smoothClosed, traceContour } from "./trace.js";

export type MedallionOptions = {
  /** Longest edge of the coin, in world units. */
  size?: number;
  /** Coin thickness. */
  thickness?: number;
  /** Bevel width; drives how much the rim catches the light. */
  bevel?: number;
  goldColor?: THREE.ColorRepresentation;
  /** Normal-map strength for the embossed artwork. */
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
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Alpha mask for the metal overlay: white where the artwork is gold, black
 * elsewhere. Three reads the green channel for `alphaMap`.
 */
function metalMaskTexture(metalness: Uint8Array, w: number, h: number): THREE.DataTexture {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = metalness[i];
    data[i * 4 + 1] = metalness[i];
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
    thickness = 0.13,
    bevel = 0.018,
    goldColor = 0xe9c46a,
    envMap = null,
    silhouette = true,
  } = options;

  const { mask, metalness, face, width, height: imgH, bounds } = analysis;

  // --- outline ---
  let shape: THREE.Shape;
  let traced = 0;
  if (silhouette) {
    const contour = traceContour(mask, width, imgH);
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) || 1;
    // Fine simplification kills the pixel staircase, then Chaikin rounds the
    // corners so curves read as curves instead of facets.
    const epsilon = Math.max(0.35, span / 2400);
    const points = contourToPoints(simplify(contour, epsilon), bounds, size);
    traced = points.length;
    shape = points.length >= 3
      ? new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, p.y)))
      : circleShape(size);
  } else {
    shape = circleShape(size);
  }

  // --- body ---
  // Straight extrusion, no bevel: a bevel offsets the outline OUTWARD, which
  // painted a fat gold rim over the artwork the flat pin does not have.
  const bodyGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 16,
    steps: 1,
  });
  bodyGeometry.computeBoundingBox();
  const box = bodyGeometry.boundingBox!;
  const offsetX = -(box.min.x + box.max.x) / 2;
  const offsetY = -(box.min.y + box.max.y) / 2;
  bodyGeometry.translate(offsetX, offsetY, -(box.min.z + box.max.z) / 2);
  const halfDepth = (box.max.z - box.min.z) / 2;

  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: goldColor,
    metalness: 1,
    roughness: 0.28,
    envMap,
    envMapIntensity: 1.2,
    clearcoat: 0.35,
    clearcoatRoughness: 0.35,
  });

  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.castShadow = true;
  body.receiveShadow = true;

  // --- face ---
  // The face is a plane carrying the artwork, masked by the artwork's own alpha
  // rather than by a traced polygon. A traced outline is only ever an
  // approximation: its triangulation bulges outside the true silhouette, which
  // let the enamel sample the page and the gold body show as a fat rim.
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) || 1;
  const scale = size / span;
  const spanX = Math.max(1, bounds.maxX - bounds.minX);
  const spanY = Math.max(1, bounds.maxY - bounds.minY);

  const faceWidth = spanX * scale;
  const faceHeight = spanY * scale;
  const faceGeometry = new THREE.PlaneGeometry(faceWidth, faceHeight, 1, 1);
  const project = (x: number, y: number) => ({
    px: x / scale + cx,
    py: -y / scale + cy,
  });
  const position = faceGeometry.getAttribute("position") as THREE.BufferAttribute;
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const { px, py } = project(position.getX(i), position.getY(i));
    uv[i * 2] = (px - bounds.minX) / spanX;
    uv[i * 2 + 1] = (py - bounds.minY) / spanY;
  }
  faceGeometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

  const map = colorTexture(face, width, imgH);
  const metalMask = metalMaskTexture(metalness, width, imgH);

  // Enamel is finished 2D colour, so it is drawn unlit and simply discards the
  // transparent background. Nothing here can over-expose or bleed.
  const enamelMaterial = new THREE.MeshBasicMaterial({ map, alphaTest: 0.5, toneMapped: false });

  // Gold bands are real metal on top of it, aligned to the same artwork pixels.
  const metalMaterial = new THREE.MeshPhysicalMaterial({
    color: goldColor,
    metalness: 1,
    roughness: 0.26,
    envMap,
    envMapIntensity: 0.9,
    clearcoat: 0.15,
    clearcoatRoughness: 0.3,
    alphaMap: metalMask,
    transparent: true,
    alphaTest: 0.5,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const enamelMesh = new THREE.Mesh(faceGeometry, enamelMaterial);
  enamelMesh.position.z = halfDepth + 0.0015;

  const metalMesh = new THREE.Mesh(faceGeometry, metalMaterial);
  metalMesh.position.z = halfDepth + 0.0022;

  const group = new THREE.Group();
  group.add(body, enamelMesh, metalMesh);

  return {
    group,
    body,
    face: enamelMesh,
    setEnvironment(env) {
      bodyMaterial.envMap = env;
      metalMaterial.envMap = env;
      bodyMaterial.needsUpdate = true;
      metalMaterial.needsUpdate = true;
    },
    dispose() {
      bodyGeometry.dispose();
      faceGeometry.dispose();
      bodyMaterial.dispose();
      enamelMaterial.dispose();
      metalMaterial.dispose();
      map.dispose();
      metalMask.dispose();
    },
  };
}

export function summarise(analysis: PinAnalysis): string {
  return `traceable blob ${analysis.bounds.maxX - analysis.bounds.minX}×${analysis.bounds.maxY - analysis.bounds.minY}px, gold ${(analysis.goldRatio * 100).toFixed(0)}%`;
}
