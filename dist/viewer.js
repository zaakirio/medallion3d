/**
 * Viewer: WebGL renderer plus direct-manipulation rotation.
 *
 * The medal behaves like an ordinary 3D object: drag it and it turns to follow
 * your hand, horizontally and vertically, and stays where you leave it. No
 * auto-spin, no momentum, no tap-to-flip.
 *
 * Framework-agnostic on purpose. Give it a container and a PinAnalysis; it owns
 * the loop. React / React Native hosts wrap this or consume `createMedallion`.
 */
import * as THREE from "three";
import { createStudioEnvironment } from "./environment.js";
import { createMedallion } from "./medallion.js";
export function createViewer(container, analysis, options = {}) {
    const { maxTilt = 1.4, radiansPerPixel = 0.011, initialPose, ...medallionOptions } = options;
    const restYaw = initialPose?.yaw ?? 0.245; // ~14°
    const restPitch = initialPose?.pitch ?? 0.105; // ~6°
    let width = container.clientWidth || 320;
    let height = container.clientHeight || width;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    Object.assign(renderer.domElement.style, {
        width: "100%", height: "100%", display: "block", touchAction: "none", cursor: "grab",
    });
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 100);
    // Frame the medal so it fills the stage the way the flat artwork does — the
    // flat asset fills ~88% of its canvas, so a fixed camera distance left the
    // live medal visibly smaller inside the same frame, with dead margin that
    // read as a wrong, oversized border.
    const frameMedal = () => {
        const radius = (medallionOptions.size ?? 2) * 0.51; // half the longest edge plus bevel/wall slack
        const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
        const distanceY = radius / Math.tan(halfFov);
        const distanceX = distanceY / Math.max(camera.aspect, 1e-6);
        camera.position.set(0, 0, Math.max(distanceY, distanceX) / 0.95);
        camera.lookAt(0, 0, 0);
    };
    frameMedal();
    const environment = createStudioEnvironment(renderer);
    scene.environment = environment;
    const keyLight = new THREE.DirectionalLight(0xfff3dd, 0.5);
    keyLight.position.set(2.4, 3.2, 4);
    scene.add(keyLight);
    // Ambient carries the artwork's own colours head-on (diffuse ≈ 1 at normal
    // incidence), so the map reads true while the env panels supply the sheen.
    scene.add(new THREE.AmbientLight(0xffffff, 0.68));
    const object = new THREE.Group();
    object.rotation.set(restPitch, restYaw, 0);
    scene.add(object);
    let medallion = createMedallion(analysis, { ...medallionOptions, envMap: environment });
    object.add(medallion.group);
    // --- direct manipulation ---
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const el = renderer.domElement;
    const onPointerDown = (event) => {
        dragging = true;
        lastX = event.clientX;
        lastY = event.clientY;
        el.setPointerCapture?.(event.pointerId);
        el.style.cursor = "grabbing";
    };
    const onPointerMove = (event) => {
        if (!dragging)
            return;
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;
        // Horizontal drag turns it left/right; vertical tips it toward/away.
        object.rotation.y += dx * radiansPerPixel;
        object.rotation.x = Math.max(-maxTilt, Math.min(maxTilt, object.rotation.x + dy * radiansPerPixel));
    };
    const onPointerUp = (event) => {
        if (!dragging)
            return;
        dragging = false;
        el.releasePointerCapture?.(event.pointerId);
        el.style.cursor = "grab";
    };
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    const observer = new ResizeObserver(() => {
        width = container.clientWidth || width;
        height = container.clientHeight || width;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        frameMedal();
    });
    observer.observe(container);
    let frame = 0;
    const tick = () => {
        frame = requestAnimationFrame(tick);
        renderer.render(scene, camera);
    };
    tick();
    return {
        renderer,
        scene,
        camera,
        get medallion() { return medallion; },
        setAnalysis(next) {
            object.remove(medallion.group);
            medallion.dispose();
            medallion = createMedallion(next, { ...medallionOptions, envMap: environment });
            object.add(medallion.group);
            frameMedal();
        },
        reset() {
            object.rotation.set(restPitch, restYaw, 0);
        },
        dispose() {
            cancelAnimationFrame(frame);
            observer.disconnect();
            el.removeEventListener("pointerdown", onPointerDown);
            el.removeEventListener("pointermove", onPointerMove);
            el.removeEventListener("pointerup", onPointerUp);
            el.removeEventListener("pointercancel", onPointerUp);
            medallion.dispose();
            environment.dispose();
            renderer.dispose();
            el.remove();
        },
    };
}
//# sourceMappingURL=viewer.js.map