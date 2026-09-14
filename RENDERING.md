# Rendering notes — how the 3D medal works, and every bug we hit

This document is the authoritative record of the medallion3d rendering
pipeline, the defects found while matching the flat pin assets, their root
causes, and the known-good tuning. If you touch `src/`, read this first —
several of these bugs produce symptoms that look like a *different* problem
than their cause.

## Pipeline (runtime, no 3D assets)

```
pin PNG (341×341, transparent margins)
  ↓ analyze.ts    classify pixels → mask, height field, metal/rough maps,
  │               face RGBA with edge-bleed, border ring, silhouette bounds
  ↓ trace.ts      Moore-neighbour contour → Douglas–Peucker (~1px) polygon
  ↓ medallion.ts  ExtrudeGeometry body (bevelled, inset) + ShapeGeometry face
  │               (map = artwork, normal = Sobel of height, ORM metal/rough)
  ↓ environment.ts procedural studio → PMREM env map (dome + panels + strips)
  ↓ viewer.ts     renderer, camera framing, pointer drag, rest pose
```

Everything is derived from the 2D artwork at runtime; the library ships no
geometry or HDR files.

## The bug catalogue (in the order they were (re)discovered)

### 1. Face UVs sampled the full canvas, not the artwork bounds — THE big one
**Present since v0.1.0. Fixed in v0.2.0 (`b5b80e4`).**

`analyzePin` returns the face RGBA as the full 341×341 canvas; the pin
artwork occupies only its bounding box inside it (e.g. x 56–282, y 13–312 on
the Ramadan Lantern). The face UVs mapped the polygon's bounding box to
`[0,1]²` — i.e. to the *whole canvas*. Consequences, all compounding:

- the artwork rendered **shrunk inside the silhouette** (to ~66% width on
  tall pins, 88% height),
- the polygon areas outside the artwork sampled **transparent margin pixels**,
  which `alphaTest` discarded, revealing the **gold body cap behind** — this
  showed as an enormous gold border "occupying an obnoxious amount of space".

Because the border was so dominant, every other defect was judged relative to
it and misdiagnosed repeatedly (see the version history in git: "unlit face",
"body hidden behind it", ring/e-mail tuning…). The fix is two lines — sample
by canvas pixel:

```ts
uv[i * 2]     = px / width;   // px = canvas-space x of the polygon vertex
uv[i * 2 + 1] = py / imgH;    // py = canvas-space y (v=0 is the top row:
                              // DataTexture flipY defaults to false)
```

**Lesson:** when a render doesn't match its source image, verify the
texture-pixel ↔ geometry correspondence *end to end* (uv range [0,1] over the
polygon is necessary but not sufficient), before tuning materials.

### 2. The unlit-face regression (v0.1.6)
Commit `f54b975` tried to fight symptom #1 by making the face an unlit
`MeshBasicMaterial` and shrinking the body to 0.82 behind it. That killed all
front lighting, and the recessed body made the extrusion read as chunky
stacked slabs on wide sides while top/bottom showed no depth at all. Fixed in
v0.1.7: the face is `MeshPhysicalMaterial` again and the body is the full
silhouette.

### 3. Chunky striped borders — normal-map cliff at the mask boundary
The height field was 235 (gold) inside the mask and 0 outside. The Sobel that
produces the normal map saw a hard cliff at the silhouette and generated wild
normals along the entire outline — rendered as metal, that read as chunky
striped/stacked borders at oblique angles. Fix (`analyze.ts`): extend the
heights outward ~4px (copy nearest interior value) *before* smoothing, so the
rim is flat ground. One line of intent: **never Sobel across the mask
boundary**.

### 4. Washed-out artwork — painted gold classified as mirror metal
`classify()` marks every warm saturated pixel as "gold". Gold-covered pins
(the Ramadan Lantern is ~44% gold) then rendered almost entirely metallic,
tinting the artwork toward mirror-gold and washing it pale under lighting.
Fix (`analyze.ts`): metalness lives **only in the border ring** — the outer
`max(3, maxDimension/70)` px of the silhouette, found by mask erosion — while
interior gold detail keeps half metalness (v0.1.7), later raised to full
metal once the environment stopped flooding (v0.1.8). The metalness map *is*
the design intent: border = struck metal, interior = painted relief.

### 5. Dead frontal lighting — an empty reflection hemisphere
Face-on, a mirror reflects whatever sits *behind the viewer*. The original
studio had only small panels there and a dark background: the face-on
reflection was a void, no matter the material. Fixes (`environment.ts`):
- a **gradient cyclorama dome** (zenith → slate horizon → lit floor) so the
  mirror always has something luminous to reflect;
- **elongated strip softboxes** flanking the camera for defined streaks that
  sweep as the medal turns;
- a **fill card below the lens**: tilting the medal forward used to mirror
  blackness and swallow gold-heavy pins (Pelmeni at +22° pitch went bronze);
  the card + lifted floor keep oblique-down views luminous.

**Lesson:** environment content IS face lighting. Never leave a hemisphere
empty and never let the floor be black.

### 6. Framing — the medal rendered small with dead margin
A fixed camera distance left the 2-unit medal filling ~74% of the stage while
the flat asset fills ~88% of its canvas. The mismatch read as "the 3D one is
smaller/wrong". Fix (`viewer.ts`): `frameMedal()` fits the camera so the
medal fills 95% of the stage, recomputed on resize.

### 7. Corrugated walls — pixel-staircase contours
Tracing the mask exactly (0.35px epsilon) kept the pixel staircase; the
extrusion wall then shaded as thousands of micro-facets and looked serrated.
Fix: simplify epsilon ~1px (`span/300`) — tight enough to hide under the
artwork's own painted outline, loose enough to collapse the staircase.

### 8. Rest pose
A head-on resting view hides the third dimension entirely. The viewer now
rests at yaw 14° / pitch 6° (`initialPose` option; `reset()` returns to it).
It is a static pose, not an auto-spin; drag works exactly as before.

## Known-good tuning (v0.2.0)

| Knob | Value | Notes |
|---|---|---|
| face material | MeshPhysicalMaterial, map + normal + ORM, envMapIntensity 0.95, clearcoat 0.5 / rough 0.3 | tone-mapped; highlights roll off instead of clipping |
| metal (ring + gold fields) | metalness 255, roughness 45 | reflection tints with the artwork colour |
| enamel | metalness 0, roughness 205 + clearcoat | colour-true, glazed |
| relief | Sobel strength 2.0, normalScale (0.9, 0.9) | embossing without shading noise |
| thickness | 0.12 | wall ≈ 4px at the 14° rest pose |
| bevel | 0.02 (thickness ×1.4, 3 segments) | body inset by exactly `2·bevel/size` so the crest lands on the face outline |
| dome | zenith 0xf2f6fc, horizon 0x3a4250, floor 0x434c5c | never a black floor |
| lights | ambient 0.68, key 0.45 (warm, up-right), strips L/R 1.6/1.2, floor bounce 1.2, fill card 1.5 | ambient carries artwork colours; specular comes from defined panels |
| exposure | ACES, 1.12 | |
| camera | fov 28°, fitted to 95% of stage | |

## Debug tooling (all in `demo/`)

- `debug.html?pin=…[&plain=1][&layers=face|body]` — single medal in a
  340px stage mirroring the app drawer; `window.__setRot(yaw, pitch)`.
- `debug-driver.mjs <tag>` — drives Playwright (SwiftShader) through
  face/yaw/pitch/hero angles for every pin in `PINS`, HD (2× DPR).
- `sheet.mjs <tag> <pin…>` — contact sheets: flat 2D vs every angle.
- `diag.html` / `uvcheck.html` — mask boundary, height/metal maps, polygon
  back-projection. **The uvcheck + face/body isolation workflow is what
  finally caught bug #1**; render comparisons at wrong sizes look like
  texture bugs and vice versa.
- `gallery.html` — human-friendly picker page for reviewing in a real
  browser (GPU) instead of SwiftShader.

## Verification checklist before shipping a change

1. `npm run build` (dist is shipped in the repo — git consumers don't build).
2. `node demo/debug-driver.mjs <tag>` across **all** pins (not just one) —
   tall tips, wide bodies, intricate tilework all behave differently.
3. Contact sheet vs the flat 2D assets: composition, border width, colour.
4. Angles: 0°, ±25° yaw, ±22° pitch, and the rest pose. Forward pitch is
   where dark-floor bugs show; yaw is where wall/stripe bugs show.
5. In-app: `verify-achievements.cjs` + a drawer capture against the real
   build (`VITE_E2E=1 npm run build:bundle -w @lingobite/web`).

## Known limitations

- **Pale/neutral outer borders will classify as background.** The classifier
  treats near-neutral bright pixels as page background; every current pin has
  a saturated gold outline so this is safe today, but a silver/platinum
  *border* would need the classifier extended (e.g. alpha-first silhouette)
  before such assets ship.
- Source textures are 341px; the viewer upscales them ~2× at 2× DPR. For
  true close-up HD, re-export the pin PNGs at ~682px — the renderer already
  benefits.
- Tests run under SwiftShader; real GPUs have better AA and slightly different
  tone response. Final judgement should be on-device (the gallery page).
