/**
 * Viewer: WebGL renderer + momentum spin + pointer tilt.
 *
 * Framework-agnostic on purpose. Give it a container and a PinAnalysis; it owns
 * the loop. React / React Native hosts wrap this or consume `createMedallion`
 * directly with their own renderer.
 */
import * as THREE from "three";
import type { PinAnalysis } from "./analyze.js";
import { createStudioEnvironment } from "./environment.js";
import { createMedallion, type Medallion, type MedallionOptions } from "./medallion.js";

export type ViewerOptions = MedallionOptions & {
  /** Idle spin, radians/second. */
  autoSpin?: number;
  /** How quickly a flick decays, per second. */
  damping?: number;
  /** Flip the coin 180° on tap. */
  flipOnTap?: boolean;
};

export type Viewer = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  medallion: Medallion;
  /** Swap the artwork without rebuilding the renderer. */
  setAnalysis(analysis: PinAnalysis): void;
  /** Nudge it, e.g. from a haptic tap. */
  spin(radiansPerSecond: number): void;
  dispose(): void;
};

export function createViewer(
  container: HTMLElement,
  analysis: PinAnalysis,
  options: ViewerOptions = {},
): Viewer {
  const { autoSpin = 0.45, damping = 1.6, flipOnTap = true, ...medallionOptions } = options;

  let width = container.clientWidth || 320;
  let height = container.clientHeight || width;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  Object.assign(renderer.domElement.style, {
    width: "100%", height: "100%", display: "block", touchAction: "none", cursor: "grab",
  });
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 100);
  camera.position.set(0, 0, 5.4);
  camera.lookAt(0, 0, 0);

  const environment = createStudioEnvironment(renderer);
  scene.environment = environment;

  const keyLight = new THREE.DirectionalLight(0xfff3dd, 1.5);
  keyLight.position.set(2.4, 3.2, 4);
  scene.add(keyLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.22));

  const tiltGroup = new THREE.Group();
  const spinGroup = new THREE.Group();
  tiltGroup.add(spinGroup);
  scene.add(tiltGroup);

  let medallion = createMedallion(analysis, { ...medallionOptions, envMap: environment });
  spinGroup.add(medallion.group);

  // --- interaction state ---
  let velocity = 0;
  let dragging = false;
  let lastX = 0;
  let targetTiltX = 0, targetTiltZ = 0;
  let flipBoost = 0;
  let scalePulse = 1;

  const el = renderer.domElement;

  const onPointerDown = (event: PointerEvent) => {
    dragging = true;
    lastX = event.clientX;
    velocity = 0;
    el.setPointerCapture?.(event.pointerId);
    el.style.cursor = "grabbing";
  };

  const onPointerMove = (event: PointerEvent) => {
    const rect = el.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    targetTiltZ = nx * 0.28;
    targetTiltX = ny * 0.22;

    if (dragging) {
      const dx = event.clientX - lastX;
      lastX = event.clientX;
      spinGroup.rotation.y += dx * 0.011;
      velocity = dx * 0.011 * 24; // rough per-second rate
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    el.releasePointerCapture?.(event.pointerId);
    el.style.cursor = "grab";
    if (flipOnTap && Math.abs(velocity) < 0.25) {
      flipBoost = Math.PI * 2; // one full lazy turn
      scalePulse = 1.08;
    }
  };

  const onPointerLeave = () => {
    targetTiltX = 0;
    targetTiltZ = 0;
  };

  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("pointermove", onPointerMove);
  el.addEventListener("pointerup", onPointerUp);
  el.addEventListener("pointercancel", onPointerUp);
  el.addEventListener("pointerleave", onPointerLeave);

  const observer = new ResizeObserver(() => {
    width = container.clientWidth || width;
    height = container.clientHeight || width;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  });
  observer.observe(container);

  let frame = 0;
  const clock = new THREE.Clock();

  const tick = () => {
    frame = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (!dragging) {
      // Momentum decays toward the idle spin.
      velocity += (autoSpin - velocity) * Math.min(1, damping * dt);
      spinGroup.rotation.y += velocity * dt;
    }

    if (flipBoost > 0) {
      const step = Math.min(flipBoost, dt * 4.5);
      spinGroup.rotation.y += step;
      flipBoost -= step;
    }

    tiltGroup.rotation.x += (targetTiltX - tiltGroup.rotation.x) * Math.min(1, 8 * dt);
    tiltGroup.rotation.z += (targetTiltZ - tiltGroup.rotation.z) * Math.min(1, 8 * dt);

    scalePulse += (1 - scalePulse) * Math.min(1, 7 * dt);
    spinGroup.scale.setScalar(scalePulse);

    renderer.render(scene, camera);
  };
  tick();

  return {
    renderer,
    scene,
    camera,
    get medallion() { return medallion; },
    setAnalysis(next) {
      spinGroup.remove(medallion.group);
      medallion.dispose();
      medallion = createMedallion(next, { ...medallionOptions, envMap: environment });
      spinGroup.add(medallion.group);
    },
    spin(radiansPerSecond) {
      velocity = radiansPerSecond;
    },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("pointerleave", onPointerLeave);
      medallion.dispose();
      environment.dispose();
      renderer.dispose();
      el.remove();
    },
  };
}
