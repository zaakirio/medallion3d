/**
 * Load a pin image in the browser and reduce it to a PinAnalysis.
 * Kept separate from `analyze` so the core stays DOM-free (testable in Node).
 */
import { analyzePin, type PinAnalysis, type PixelInput } from "./analyze.js";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load image: ${url}`));
    image.src = url;
  });
}

export async function loadPin(url: string): Promise<PinAnalysis> {
  const image = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("2D canvas context unavailable");
  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  return analyzePin({ data: imageData.data, width: canvas.width, height: canvas.height } as PixelInput);
}

export { analyzePin } from "./analyze.js";
export type { PinAnalysis, PixelInput } from "./analyze.js";
export { createMedallion, summarise } from "./medallion.js";
export type { Medallion, MedallionOptions } from "./medallion.js";
export { createViewer } from "./viewer.js";
export type { Viewer, ViewerOptions } from "./viewer.js";
export { createStudioEnvironment } from "./environment.js";
export { traceContour, simplify, contourToPoints } from "./trace.js";
export type { Point } from "./trace.js";
