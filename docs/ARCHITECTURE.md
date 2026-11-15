# Architecture

```
main/
  main.js        Electron main process: window, menu, file system, dialogs, PDF printing
  media.js       Video/audio: media folder, dsmedia:// streaming protocol, ffmpeg conversion and MP4 encoding
  preload.js     The only bridge to the renderer (contextBridge `window.api`)
renderer/
  index.html     App shell
  css/app.css    All styling
  js/formats.js  Catalog of design sizes (px / mm / in) and unit conversion
  js/document.js Document model, element factories, group/align/reorder, assets, undo history
  js/render.js   Page → standalone SVG (used both on screen and for every export)
  js/templates.js Starter templates as size-adaptive layout functions
  js/ui.js       Icons, DOM helper, modals, toasts, text measurement
  js/exporter.js PNG/JPEG rasterisation, SVG, PDF, export dialog
  js/video.js    Clip import (duration, poster), playback compositor, preview player, MP4 export
  js/editor.js   Canvas interaction, panels, pages, autosave
  js/app.js      Dashboard, projects, settings, roadmap pages
test/            Node unit tests for the pure modules (formats, model, renderer, templates)
```

## Key decisions

- **One renderer for screen and export.** `render.renderPage()` produces pure SVG. The editor shows that SVG, and every export uses the same SVG. PNG and JPEG are drawn from it on a canvas, SVG is saved directly, and PDF is printed by Chromium from it. What you see is what you export.
- **Units.** The editor works in pixels. Print formats use 96 px per inch, so an A4 page is 793.7 × 1122.5 px. Exports scale to any DPI, and PDF pages get the exact physical size. Bleed is added by expanding the SVG `viewBox`.
- **Project format (`.dstudio`).** A JSON file holding the format, the pages and their elements, and `assets`. Each asset is an embedded image stored once as a data URL. Elements refer to images as `asset:<id>`, so undo history never copies image data, and unused assets are removed on save. Files are written atomically, to a temp file and then renamed.
- **Security.** `contextIsolation`, `sandbox` and no `nodeIntegration`. A strict Content Security Policy is set. Navigation and new windows are blocked. Deleting a project sends it to the Recycle Bin.
- **No framework, no runtime dependencies.** The renderer is plain JavaScript, which keeps the app small and easy to build. The only dev dependencies are `electron` and `electron-builder`.

## Extending

- **New element type:** add a factory in `document.js`, markup in `render.js` (`elementMarkup`), and a properties section in `editor.js`.
- **New size:** add one line to `FORMATS` in `formats.js`.
- **New template:** add an object with `build(w, h)` to `templates.js`. The unit tests render every template at every size.
- **AI features (Phase 2):** API calls belong in the main process, where keys stay out of the renderer. Expose them through `preload.js`. The AI assistant should send edit commands through the existing `cmd` functions, so every AI change can be undone.

## Video

- Uploaded clips are **copied** into `Design Studio Projects/media/` and referenced as `media:<file>`. They are not embedded in the project file, because videos are large. The renderer streams them through the `dsmedia://` protocol, which supports Range requests so seeking works and sends CORS headers so frames can be drawn on a canvas.
- Each page is a scene lasting `page.duration` seconds. A `video` element shows its poster frame in the editor. `doc.audio` holds the music and voice tracks for the timeline.
- **Compositor** (`video.js`): it splits each page into still layers (rendered once from the page SVG) and live video layers, then draws them in order on a canvas. Sound goes through Web Audio, with gain nodes handling volume and fades.
- **MP4 export:** the canvas and the audio stream are recorded in real time with `MediaRecorder` (WebM) and streamed to disk in chunks. ffmpeg (`ffmpeg-static`, unpacked from the asar) then converts the recording to H.264/AAC MP4 with `+faststart`.
