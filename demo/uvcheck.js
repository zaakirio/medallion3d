// Quantitative UV check: project face vertices back to pixel space, compare
// with the mask bounds, and show where the texture corners land.
import { loadPin } from "../dist/index.js";

const pin = new URLSearchParams(location.search).get("pin") || "./pins/ramadan-lantern.png";
const analysis = await loadPin(pin);
const { bounds, width, height } = analysis;
const b = bounds;
const spanX = b.maxX - b.minX, spanY = b.maxY - b.minY;
const span = Math.max(spanX, spanY) || 1;

const out = [];
const push = (s) => out.push(s);

push(`image ${width}x${height}`);
push(`bounds x ${b.minX}..${b.maxX} (${spanX}) y ${b.minY}..${b.maxY} (${spanY}) span=${span}`);

// Now build the same shape the medallion builder builds and inspect UVs.
const { traceContour, simplify, contourToPoints } = await import("../dist/index.js");
const contour = traceContour(analysis.mask, width, height);
const epsilon = Math.max(0.35, span / 2400);
const pts = contourToPoints(simplify(contour, epsilon), bounds, 2);
push(`contour ${contour.length} pts, simplified ${pts.length}`);

// world->pixel: px = wx / (size/span) + cx  (size=2)
const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
const scale = 2 / span;
const back = pts.map((p) => ({
  x: p.x / scale + cx,
  y: -p.y / scale + cy,
}));
const xs = back.map((p) => p.x), ys = back.map((p) => p.y);
push(`polygon back in pixels: x ${Math.min(...xs).toFixed(1)}..${Math.max(...xs).toFixed(1)} y ${Math.min(...ys).toFixed(1)}..${Math.max(...ys).toFixed(1)}`);

// UVs per corner of the bbox in UV space:
push(`uv of bounds corners: (${(b.minX - b.minX) / spanX},${(b.minY - b.minY) / spanY}) .. (${(b.maxX - b.minX) / spanX},${(b.maxY - b.minY) / spanY})`);

document.getElementById("info").textContent = out.join("  ·  ");
window.__ready = true;
