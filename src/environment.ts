/**
 * Procedural studio environment.
 *
 * Minted's pull is "real studio reflections that sweep across the metal as it
 * turns". We get that from an HDR environment map — but generating it from a
 * few emissive planes means the library ships no asset files at all, which is
 * the whole point.
 */
import * as THREE from "three";

export type StudioOptions = {
  /** Overall exposure of the virtual softboxes. */
  intensity?: number;
  background?: THREE.ColorRepresentation;
};

export function createStudioEnvironment(
  renderer: THREE.WebGLRenderer,
  { intensity = 1, background = 0x39404e }: StudioOptions = {},
): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);

  const softbox = (
    x: number, y: number, z: number, w: number, h: number,
    color: THREE.ColorRepresentation, gain: number,
  ) => {
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    material.color.set(color).multiplyScalar(gain * intensity);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  };

  softbox(0, 4, 2.5, 8, 4, 0xffffff, 3.0); // key overhead
  // A broad frontal fill: without it the face reads near-black when viewed head-on.
  softbox(0, 0, 4.5, 7, 7, 0xffffff, 1.6);
  softbox(-4, 0.5, 1.5, 3.5, 5, 0xdce8ff, 1.7); // cool left
  softbox(4, -1, 1.5, 3.5, 5, 0xffd9a8, 1.3); // warm right
  softbox(0, -4, 1, 7, 3, 0x54607a, 1.0); // soft floor bounce

  const target = pmrem.fromScene(scene, 0.02);
  pmrem.dispose();
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
  return target.texture;
}
