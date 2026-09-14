/**
 * Procedural studio environment.
 *
 * Minted's pull is "real studio reflections that sweep across the metal as it
 * turns". We get that from an HDR environment map — but generating it from a
 * few emissive planes means the library ships no asset files at all, which is
 * the whole point.
 */
import * as THREE from "three";
export function createStudioEnvironment(renderer, { intensity = 1, background = 0x39404e } = {}) {
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
    softbox(0, 4, 2.5, 8, 4, 0xffffff, 2.4); // key overhead
    // A small, off-axis frontal panel: on-axis floods the dielectric enamel with
    // specular and washes the artwork pale. Kept compact so it reads as a sheen
    // that sweeps across the face as the medal turns, not a static glare.
    softbox(-1.6, 1.1, 4.2, 3.5, 3.5, 0xffffff, 0.55);
    // Elongated strip lights in front of the medal: the defined reflections the
    // gold fields show head-on, like strip softboxes in a coin photo. Narrow so
    // they streak across the metal and sweep as the medal turns.
    softbox(-2.4, 0.6, 3.6, 1.1, 6, 0xf6f9ff, 1.7); // cool vertical strip, left
    softbox(2.7, -0.7, 3.6, 0.9, 4.4, 0xfff3dc, 1.3); // warm strip, lower right
    softbox(-4, 0.5, 1.5, 3.5, 5, 0xdce8ff, 1.8); // cool left
    softbox(4, -1, 1.5, 3.5, 5, 0xffd9a8, 1.5); // warm right
    softbox(0, -4, 1, 7, 3, 0x54607a, 1.0); // soft floor bounce
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