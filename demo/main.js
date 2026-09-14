import { loadPin, createViewer, summarise } from "../dist/index.js";

const PINS = [
  { name: "Eiffel Tower", file: "./pins/eiffel-tower.png" },
  { name: "Saint Basil's", file: "./pins/saint-basils-cathedral.png" },
  { name: "Dallah", file: "./pins/dallah-coffee.png" },
];

const stage = document.getElementById("stage");
const hud = document.getElementById("hud");
const note = document.getElementById("note");

let viewer = null;

async function show(pin, button) {
  for (const el of hud.querySelectorAll("button")) {
    el.setAttribute("aria-pressed", String(el === button));
  }
  note.textContent = `loading ${pin.name}…`;
  const analysis = await loadPin(pin.file);
  if (viewer) {
    viewer.setAnalysis(analysis);
  } else {
    viewer = createViewer(stage, analysis);
    window.__medallion = viewer;
  }
  note.textContent = `${pin.name} — ${summarise(analysis)} · drag to rotate`;
  window.__medallionReady = true;
}

for (const pin of PINS) {
  const button = document.createElement("button");
  button.textContent = pin.name;
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => void show(pin, button));
  hud.appendChild(button);
}

const requested = new URLSearchParams(location.search).get("pin");
const initial = PINS.find((p) => p.file.includes(requested)) ?? PINS[0];
const initialButton = [...hud.querySelectorAll("button")][PINS.indexOf(initial)];
void show(initial, initialButton);
