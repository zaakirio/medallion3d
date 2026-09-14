// Gallery: one shared viewer; the picker swaps the pin.
import { loadPin, createViewer, summarise } from "../dist/index.js";

const PINS = [
  ["eiffel-tower", "Eiffel Tower"],
  ["saint-basils-cathedral", "Saint Basil's"],
  ["pelmeni", "Pelmeni"],
  ["matryoshka-doll", "Matryoshka"],
  ["croissant", "Croissant"],
  ["fleur-de-lis", "Fleur-de-lis"],
  ["gallic-rooster", "Gallic Rooster"],
  ["dallah-coffee", "Dallah Coffee"],
  ["ramadan-lantern", "Ramadan Lantern"],
  ["falcon", "Falcon"],
  ["oud", "Oud"],
  ["arabesque-tilework", "Arabesque Tilework"],
  ["accordion", "Accordion"],
];

const stage = document.getElementById("stage");
const hint = document.getElementById("hint");
const name = document.getElementById("name");
const picker = document.getElementById("pins");

let viewer = null;
let busy = false;

async function show(slug, title, button) {
  if (busy) return;
  busy = true;
  for (const b of picker.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b === button));
  name.textContent = title;
  hint.textContent = "loading…";
  try {
    const analysis = await loadPin(`./pins/${slug}.png`);
    if (!viewer) viewer = createViewer(stage, analysis);
    else viewer.setAnalysis(analysis);
    window.__medallion = viewer;
    hint.textContent = "drag to rotate";
  } catch {
    hint.textContent = "could not load this pin";
  }
  busy = false;
}

for (const [slug, title] of PINS) {
  const button = document.createElement("button");
  button.setAttribute("aria-pressed", "false");
  const img = new Image();
  img.src = `./pins/${slug}.png`;
  img.alt = "";
  const label = document.createElement("small");
  label.textContent = title;
  button.append(img, label);
  button.addEventListener("click", () => void show(slug, title, button));
  picker.append(button);
}

const first = picker.querySelector("button");
if (first) first.click();
