// Debug harness: same defaults the LingoBite MedallionViewer uses, in a stage
// that mirrors the app's 340px drawer frame. Exposes the viewer and a rotation
// setter so Playwright can capture exact angles.
import { loadPin, createViewer, summarise } from "../dist/index.js";

const pin = new URLSearchParams(location.search).get("pin") || "./pins/eiffel-tower.png";
const stage = document.getElementById("stage");
const note = document.getElementById("note");

const analysis = await loadPin(pin);
const viewer = createViewer(stage, analysis);

// Diagnostic modes: ?plain=1 unlit face; ?layers=face|body isolates a mesh.
const params = new URLSearchParams(location.search);
if (params.has("plain")) {
  const face = viewer.medallion.face;
  face.material = new (await import("../node_modules/three/build/three.module.js")).MeshBasicMaterial({
    map: face.material.map,
    alphaTest: 0.5,
    toneMapped: false,
  });
}
if (params.get("layers") === "face") viewer.medallion.body.visible = false;
if (params.get("layers") === "body") viewer.medallion.face.visible = false;

window.__medallion = viewer;
window.__obj = viewer.scene.children.find((o) => o.isGroup && o.children.length);

// Exact-angle hook: (yaw degrees, pitch degrees).
window.__setRot = (yawDeg, pitchDeg) => {
  const d = Math.PI / 180;
  window.__obj.rotation.set(pitchDeg * d, yawDeg * d, 0);
};

window.__ready = true;
note.textContent = `${pin} — ${summarise(analysis)}`;
