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

1. **Classify** every pixel: off-white page → transparent, warm yellow band → gold
   metal, everything else → enamel. The largest foreground blob is kept and its
   holes filled, so pale interior detail doesn't punch through the coin.
2. **Trace** that blob's boundary (Moore-neighbour tracing), then simplify it
   (Douglas–Peucker) into a polygon.
3. **Extrude** the polygon with a bevel — that is the coin body, in gold PBR.
4. **Derive maps** from the artwork: gold ridges become a height field, the height
   field becomes a tangent-space normal map, and roughness/metalness are packed
   into one ORM texture (roughness in G, metalness in B, the channels Three reads).
5. **Light** with a procedurally generated studio environment (`PMREMGenerator`
   over a few emissive planes) — no HDR file ships with the library.
6. **Animate** with momentum: flicks decay into an idle spin, pointer position
   tilts the coin, a tap flips it.

## Interactive behaviour

| Gesture | Result |
| --- | --- |
| Drag horizontally | Spin, with release momentum |
| Idle | Slow auto-spin |
| Pointer move | Subtle parallax tilt |
| Tap / click | Lazy 180°+ flip with a scale pop |

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

`0.1.0` — works end to end (verified headlessly: silhouette traced, coin rendered,
pin switching, no console errors).

Roadmap:
- [ ] SVG input, in addition to raster PNG
- [ ] Engraved lettering pass
- [ ] Orange-peel die-struck back face
- [ ] Presets (`gold`, `silver`, `bronze`, `platinum`) for tiered medals
- [ ] React component wrapper (`<Medallion />`)
- [ ] Node-side unit tests for `analyzePin` / `traceContour`
- [ ] Optional ML depth estimation for artwork without a clean gold outline

## License

MIT.
