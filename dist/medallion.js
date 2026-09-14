/**
 * Medallion builder: PinAnalysis → a THREE.Group coin.
 *
 * The body is the pin's own silhouette extruded with a bevel; the face is the
 * same silhouette carrying the artwork plus a derived normal map, so the gold
 * outline reads as raised metal and the enamel sits in shallow inlay.
 */
import * as THREE from "three";
import { contourToPoints, simplify, smoothClosed, traceContour } from "./trace.js";
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
/** Circle fallback so a failed trace still produces something solid. */
function circleShape(size) {
    const r = size / 2;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, r, 0, Math.PI * 2, false);
    return shape;
}
export function createMedallion(analysis, options = {}) {
    const { size = 2, thickness = 0.16, bevel = 0.03, goldColor = 0xe9c46a, envMap = null, silhouette = true, } = options;
    const { mask, metalness, face, width, height: imgH, bounds } = analysis;
    // --- outline ---
    let shape;
    let traced = 0;
    if (silhouette) {
        const contour = traceContour(mask, width, imgH);
        const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) || 1;
        // Fine simplification kills the pixel staircase, then Chaikin rounds the
        // corners so curves read as curves instead of facets.
        const epsilon = Math.max(0.7, span / 650);
        const points = contourToPoints(smoothClosed(simplify(contour, epsilon), 2), bounds, size);
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
        bevelEnabled: true,
        bevelThickness: bevel * 1.4,
        bevelSize: bevel,
        bevelSegments: 6,
        curveSegments: 16,
        steps: 1,
    });
    bodyGeometry.computeBoundingBox();
    const box = bodyGeometry.boundingBox;
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
    const faceGeometry = new THREE.ShapeGeometry(shape, 16);
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
    /**
   * Alpha mask for the metal overlay: white where the artwork is gold, black
   * elsewhere. Three reads the green channel for `alphaMap`.
   */
    function metalMaskTexture(metalness, w, h) {
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
    const map = colorTexture(face, width, imgH);
    const metalMask = metalMaskTexture(metalness, width, imgH);
    // Enamel is finished 2D colour, so it is drawn unlit: whatever the environment
    // does, the artwork never over-exposes to white on a bright frontal highlight.
    const enamelMaterial = new THREE.MeshBasicMaterial({ map, alphaTest: 0.5, toneMapped: false });
    // Gold bands are real metal on top of it, with their own reflections.
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
    enamelMesh.position.z = 0.0005; // sits a hair proud of the cap
    const metalMesh = new THREE.Mesh(faceGeometry, metalMaterial);
    metalMesh.position.z = 0.0012; // the raised metal bands, just in front
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
export function summarise(analysis) {
    return `traceable blob ${analysis.bounds.maxX - analysis.bounds.minX}×${analysis.bounds.maxY - analysis.bounds.minY}px, gold ${(analysis.goldRatio * 100).toFixed(0)}%`;
}
//# sourceMappingURL=medallion.js.map