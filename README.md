# Humans Card Viewer

A lightweight Web Component for previewing Humans GLB assets with a clean, product-style lighting setup.

Live demo: https://puschkarew.github.io/humans-card/

## Quick Start (script tag)

1. Build the library.
2. Open `index.html` from a local server (recommended) or via GitHub Pages.

```sh
npm install
npm run build
python -m http.server
```

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Humans Viewer Demo</title>
  </head>
  <body>
    <humans-viewer src="/path/to/model.glb" preset="front" zoom="true"></humans-viewer>
    <script src="./dist/humans-viewer.js"></script>
  </body>
</html>
```

## Attributes

| Attribute | Type | Description |
| --- | --- | --- |
| `src` | string | GLB URL to load. If omitted, a demo cube is shown. |
| `preset` | string | Named camera preset: `front`, `back`, `left`, `right`. |
| `variant` | string | Material variant name (KHR or by name). |
| `background` | string | CSS background applied to the canvas wrapper. |
| `zoom` | boolean | Enables wheel/pinch zoom. Defaults to `true`. |
| `fallback-src` | string | Image URL for fallback when WebGL or GLB loading fails. |
| `light-key-pos` | vec3 | Key light position, e.g. `2.5 2.0 3.0`. |
| `light-key-color` | string | Key light color (CSS color string). |
| `light-key-intensity` | number | Key light intensity. |
| `light-fill-pos` | vec3 | Fill light position. |
| `light-fill-color` | string | Fill light color. |
| `light-fill-intensity` | number | Fill light intensity. |
| `light-rim-pos` | vec3 | Rim light position. |
| `light-rim-color` | string | Rim light color. |
| `light-rim-intensity` | number | Rim light intensity. |
| `light-ambient-color` | string | Ambient light color. |
| `light-ambient-intensity` | number | Ambient light intensity. |

Vec3 values can be space or comma separated, for example `2.5 2 3` or `2.5, 2, 3`.

## JavaScript API

```ts
import { register, create } from "./src/main";

register();
const viewer = create(document.body, { src: "model.glb", preset: "front", zoom: true });

viewer.setPreset("left");
viewer.setVariant("VariantName");
viewer.setPresets([{ name: "hero", yaw: 0.2, pitch: -0.1 }]);
viewer.setLights({ key: { intensity: 1.3 } });
const state = viewer.getState();
viewer.dispose();
```

## Defaults

Presets:
- `front`, `back`, `left`, `right`

Lights:
- Key: pos `[2.5, 2.0, 3.0]`, color `#ffffff`, intensity `1.2`
- Fill: pos `[-2.0, 1.0, 2.5]`, color `#cfd8ff`, intensity `0.6`
- Rim: pos `[0.0, 2.5, -3.0]`, color `#ffffff`, intensity `0.8`
- Ambient: color `#ffffff`, intensity `0.2`

Background:
- `radial-gradient(120% 120% at 50% 30%, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.0) 45%), linear-gradient(180deg, #101014 0%, #0b0b0f 100%)`

## Development

```sh
npm install
npm run build
npm run dev
```

## GitHub Pages

This repo ships a root `index.html` that loads `./dist/humans-viewer.js` so it can run on GitHub Pages at:

https://puschkarew.github.io/humans-card/

To publish updates:
1. Run `npm run build` to regenerate `dist/`.
2. Commit the `dist/` files.
3. Ensure GitHub Pages is configured to serve from `main` / root.
