/**
 * Medallion builder: PinAnalysis → a THREE.Group coin.
 *
 * The body is the pin's own silhouette extruded with a bevel; the face is the
 * same silhouette carrying the artwork plus a derived normal map, so the gold
 * outline reads as raised metal and the enamel sits in shallow inlay.
 */
import * as THREE from "three";
import { contourToPoints, simplify, traceContour } from "./trace.js";
function colorTexture(face, w, h) {
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
/** Pack roughness into G and metalness into B — the channels Three.js reads. */
function ormTexture(roughness, metalness, w, h) {
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
function normalTexture(height, w, h, strength) {
    const data = new Uint8Array(w * h * 4);
    const sample = (x, y) => height[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))] / 255;
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
function circleShape(size) {
    const r = size / 2;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, r, 0, Math.PI * 2, false);
    return shape;
}
export function createMedallion(analysis, options = {}) {
    const { size = 2, thickness = 0.16, bevel = 0.03, goldColor = 0xe9c46a, relief = 2.6, envMap = null, silhouette = true, } = options;
    const { mask, heightMap, metalness, roughness, face, width, height: imgH, bounds } = analysis;
    // --- outline ---
    let shape;
    let traced = 0;
    if (silhouette) {
        const contour = traceContour(mask, width, imgH);
        const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) || 1;
        const epsilon = Math.max(0.35, span / 2400);
        const points = contourToPoints(simplify(contour, epsilon), bounds, size);
        traced = points.length;
        shape = points.length >= 3
            ? new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, p.y)))
            : circleShape(size);
    }
    else {
        shape = circleShape(size);
    }
    // --- body ---
    const bodyGeometry = new THREE.ExtrudeGeometry(shape, {
        depth: thickness,
        // No bevel: a bevel offsets the silhouette OUTWARD, so the gold body paints a
        // ring around the artwork that the flat pin does not have.
        bevelEnabled: false,
        curveSegments: 8,
        steps: 1,
    });
    bodyGeometry.computeBoundingBox();
    const box = bodyGeometry.boundingBox;
    const offsetX = -(box.min.x + box.max.x) / 2;
    const offsetY = -(box.min.y + box.max.y) / 2;
    bodyGeometry.translate(offsetX, offsetY, -(box.min.z + box.max.z) / 2);
    // Pull the body inside the artwork: the traced outline is an approximation,
    // so an exactly-matching body still peeks around the face as a gold rim.
    bodyGeometry.scale(0.82, 0.82, 1);
    const halfDepth = (box.max.z - box.min.z) / 2;
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
        color: goldColor,
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
    const position = faceGeometry.getAttribute("position");
    const uv = new Float32Array(position.count * 2);
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) || 1;
    const scale = size / span;
    const spanX = Math.max(1, bounds.maxX - bounds.minX);
    const spanY = Math.max(1, bounds.maxY - bounds.minY);
    for (let i = 0; i < position.count; i++) {
        const wx = position.getX(i) - offsetX;
        const wy = position.getY(i) - offsetY;
        const px = wx / scale + cx;
        const py = -wy / scale + cy;
        uv[i * 2] = (px - bounds.minX) / spanX;
        uv[i * 2 + 1] = (py - bounds.minY) / spanY;
    }
    faceGeometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    const map = colorTexture(face, width, imgH);
    const normalMap = normalTexture(heightMap, width, imgH, relief);
    const orm = ormTexture(roughness, metalness, width, imgH);
    // The artwork is finished 2D colour. Lighting it washes the enamel out and
    // clips highlights to white, so the face is drawn unlit and simply discards the
    // transparent background. The gold body behind supplies the metal.
    const faceMaterial = new THREE.MeshBasicMaterial({ map, alphaTest: 0.5, toneMapped: false });
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
export function summarise(analysis) {
    return `traceable blob ${analysis.bounds.maxX - analysis.bounds.minX}×${analysis.bounds.maxY - analysis.bounds.minY}px, gold ${(analysis.goldRatio * 100).toFixed(0)}%`;
}
//# sourceMappingURL=medallion.js.map