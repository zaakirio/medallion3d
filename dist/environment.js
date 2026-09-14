/**
 * Procedural studio environment.
 *
 * Minted's pull is "real studio reflections that sweep across the metal as it
 * turns". We get that from an HDR environment map — but generating it from
 * emissive geometry means the library ships no asset files at all, which is
 * the whole point.
 *
 * The dome is the quiet workhorse: head-on, a mirror reflects whatever sits
 * behind the viewer, and an empty hemisphere reads as dead metal. A soft
 * zenith-to-floor gradient — like a photo sweep wrapping the set — fills the
 * gold with a natural luminous falloff, while the panels and strips supply the
 * defined highlights that sweep as the medal turns.
 */
import * as THREE from "three";
export function createStudioEnvironment(renderer, { intensity = 1, background = 0x39404e } = {}) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(background);
    // --- gradient cyclorama dome ---
    {
        const geometry = new THREE.SphereGeometry(10, 48, 24);
        const position = geometry.getAttribute("position");
        const colors = new Float32Array(position.count * 3);
        const zenith = new THREE.Color(0xf2f6fc); // cool white sweep
        const horizon = new THREE.Color(0x3a4250); // studio gray-blue
        const floor = new THREE.Color(0x434c5c); // lifted slate — a tilted medal
        // mirrors whatever is below the horizon, so the floor stays a lit fill,
        // not a void
        const c = new THREE.Color();
        for (let i = 0; i < position.count; i++) {
            const y = position.getY(i) / 10;
            if (y >= 0)
                c.copy(horizon).lerp(zenith, Math.pow(y, 0.65));
            else
                c.copy(horizon).lerp(floor, Math.pow(-y, 0.75));
            colors[i * 3] = c.r * intensity;
            colors[i * 3 + 1] = c.g * intensity;
            colors[i * 3 + 2] = c.b * intensity;
        }
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        const dome = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }));
        scene.add(dome);
    }
    const softbox = (x, y, z, w, h, color, gain) => {
        const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
        material.color.set(color).multiplyScalar(gain * intensity);
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
        mesh.position.set(x, y, z);
        mesh.lookAt(0, 0, 0);
        scene.add(mesh);
    };
    softbox(0, 4, 2.5, 8, 4, 0xffffff, 2.2); // key overhead
    // Elongated strip lights flanking the camera: the defined streaks the gold
    // shows head-on, like strip softboxes in a coin photo. Narrow so they read
    // as highlights, not glare, and sweep as the medal turns.
    softbox(-2.4, 0.7, 3.6, 1.1, 6, 0xf6f9ff, 1.6); // cool vertical strip, left
    softbox(2.7, -0.6, 3.6, 0.9, 4.4, 0xfff3dc, 1.2); // warm strip, lower right
    softbox(-4, 0.5, 1.5, 3.5, 5, 0xdce8ff, 1.6); // cool left
    softbox(4, -1, 1.5, 3.5, 5, 0xffd9a8, 1.4); // warm right
    softbox(0, -4, 1, 7, 3, 0x54607a, 1.2); // soft floor bounce
    // Fill card below the lens, like the white/gold reflector a photographer
    // slides under a coin: keeps oblique-down views of the face luminous.
    softbox(0, -2.8, 3.2, 5.5, 2.2, 0xf5ecdd, 1.5);
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