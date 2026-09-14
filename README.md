# medallion3d

**Turn flat 2D artwork into a physically-lit 3D gold medallion — at runtime, with no 3D assets.**

Point it at an enamel-pin PNG and it traces the outline, extrudes it into a real
coin with a beveled rim, derives relief and material maps from the artwork, and
lights it with a procedural studio environment so reflections sweep across the
metal as it turns. Drag to spin, tap to flip.

Built for the web (Three.js) with a renderer-agnostic core so React Native,
React, or any custom host can drive it.

> Inspired by [haplollc/Minted](https://github.com/haplollc/Minted) (Swift/SwiftUI, MIT),
> which does this beautifully for SwiftUI. This is an independent JavaScript
> implementation for the web and React Native. No code is shared.

## Why

Achievement badges, collectibles, loyalty stamps and awards all want to feel like
*things*. Normally that means shipping model files, UV maps and normal maps per
badge. `medallion3d` generates all of it from the 2D art you already have, so a
new badge is a new PNG and nothing else.

## Install

```sh
npm install medallion3d three
```

`three` is a peer dependency (`>=0.160`).

## Use

```ts
import { loadPin, createViewer } from "medallion3d";

const analysis = await loadPin("/pins/eiffel-tower.png");
const viewer = createViewer(document.getElementById("stage"), analysis);
```

That is the whole integration.

### Custom renderers

If you already own a render loop (React Three Fiber, a game engine, a native
host), use the pieces instead of the viewer:

```ts
import { analyzePin, createMedallion, createStudioEnvironment } from "medallion3d";

const analysis = analyzePin({ data: pixelData, width, height });   // pure, no DOM
const env = createStudioEnvironment(renderer);                     // procedural HDR
const medallion = createMedallion(analysis, { envMap: env, size: 2 });
scene.add(medallion.group);
```

`analyzePin` is dependency-free and DOM-free, so it runs in Node and in a worker.

## How it works

1. **Classify** every pixel against the transparent canvas: warm saturated
   pixels are painted gold, everything else enamel; near-neutral bright pixels
   connected to the canvas edge are page background. The largest foreground
   blob wins and its holes are filled, so pale interior detail never punches
   through the coin.
2. **Trace** that blob's boundary (Moore-neighbour tracing), simplify it
   (Douglas–Peucker, ~1px) into a polygon, and extrude it with a bevel — that
   is the coin body, in gold PBR.
3. **Derive maps** from the artwork: a height field (gold ridges proud, enamel
   inlay, heights extended past the silhouette so no normal-map cliff shows),
   a tangent-space normal map from its Sobel, and roughness/metalness packed
   into one ORM texture. Metalness lives in the pin's border ring; interior
   gold reads as painted relief.
4. **Map the face by canvas pixel** so the artwork fills the silhouette
   edge-to-edge, exactly like the flat asset.
5. **Light** with a procedurally generated studio (`PMREMGenerator` over a
   gradient dome, softboxes and strip lights) — no HDR file ships with the
   library, and the face-on reflection always has something luminous to show.
6. **Rest and drag**: the medal rests at a slight turn so the metal catches
   light immediately, and drags orbit it directly — no momentum, no auto-spin.

Full rendering notes — root causes of every rendering bug hit along the way,
the known-good tuning table, and the verification workflow — live in
[RENDERING.md](./RENDERING.md).

## Interactive behaviour

| Gesture | Result |
| --- | --- |
| Rest pose | Slight turn (yaw 14°, pitch 6°) so depth and reflections read immediately |
| Drag | Direct orbit, horizontal and vertical, clamped tilt (default 80°) |
| Release | Stays exactly where you leave it |

## React Native

The core (`analyzePin`, `createMedallion`, `createStudioEnvironment`) builds a
plain `THREE.Group`. Feed it to [`expo-gl`](https://docs.expo.dev/versions/latest/sdk/gl-view/)
with Three.js, or `@react-three/fiber/native`. `loadPin` uses a DOM canvas, so
supply pixels from `expo-image-manipulator` / `expo-asset` and call `analyzePin`
directly instead.

## Demo

```sh
npm install
npm run build
python3 -m http.server 8144      # then open http://127.0.0.1:8144/demo/
```

The demo loads three sample pins and lets you switch between them.

## Status

`0.2.x` — production: this renders the achievement medals in the LingoBite
web app. Known limitation: pale/neutral *outer borders* classify as page
background (all current pins use saturated gold outlines); see
[RENDERING.md](./RENDERING.md) before adding silver/platinum-tier assets.

Roadmap:
- [ ] Alpha-first silhouette (safe silver/platinum borders)
- [ ] SVG input, in addition to raster PNG
- [ ] Engraved lettering pass
- [ ] Die-struck back face
- [ ] React component wrapper (`<Medallion />`)
- [ ] Node-side unit tests for `analyzePin` / `traceContour`

## License

MIT.
