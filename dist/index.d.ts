/**
 * Load a pin image in the browser and reduce it to a PinAnalysis.
 * Kept separate from `analyze` so the core stays DOM-free (testable in Node).
 */
import { type PinAnalysis } from "./analyze.js";
export declare function loadPin(url: string): Promise<PinAnalysis>;
export { analyzePin } from "./analyze.js";
export type { PinAnalysis, PixelInput } from "./analyze.js";
export { createMedallion, summarise } from "./medallion.js";
export type { Medallion, MedallionOptions } from "./medallion.js";
export { createViewer } from "./viewer.js";
export type { Viewer, ViewerOptions } from "./viewer.js";
export { createStudioEnvironment } from "./environment.js";
export { traceContour, simplify, contourToPoints } from "./trace.js";
export type { Point } from "./trace.js";
//# sourceMappingURL=index.d.ts.map