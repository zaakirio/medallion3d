/**
 * Procedural studio environment.
 *
 * Minted's pull is "real studio reflections that sweep across the metal as it
 * turns". We get that from an HDR environment map — but generating it from a
 * few emissive planes means the library ships no asset files at all, which is
 * the whole point.
 */
import * as THREE from "three";
export function createStudioEnvironment(renderer, { intensity = 1, background = 0x0d1017 } = {}) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(background);
    const softbox = (x, y, z, w, h, color, gain) => {
        const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
        material.color.set(color).multiplyScalar(gain * intensity);
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
        mesh.position.set(x, y, z);
        mesh.lookAt(0, 0, 0);
        scene.add(mesh);
    };
    softbox(0, 4, 2.5, 8, 4, 0xffffff, 3.4); // key overhead
    softbox(-4, 0.5, 1.5, 3.5, 5, 0xcfe0ff, 1.5); // cool left
    softbox(4, -1, 1.5, 3.5, 5, 0xffd9a8, 1.1); // warm right
    softbox(0, -4, 1, 7, 3, 0x2a3b52, 0.8); // soft floor bounce
    const target = pmrem.fromScene(scene, 0.02);
    pmrem.dispose();
    scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            o.material.dispose();
        }
    });
    return target.texture;
}
//# sourceMappingURL=environment.js.map