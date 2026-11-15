# Design Studio

An AI-powered graphic design and creative studio for Windows, built with Electron.
Create social media posts, presentations, documents, print designs and merchandise graphics with a drag-and-drop editor, ready-made sizes and templates.

**Current version: 0.3.0 — Phase 1 (Core Design Studio), video and audio, and the asset library**

## Download and run (no programming needed)

1. Open the **Actions** tab of this repository on GitHub.
2. Click the latest green **Build Windows app** run.
3. Under **Artifacts**, download **DesignStudio-Windows** and unzip it.
4. Run `Design Studio Setup 0.3.0.exe` to install, or `DesignStudio-Portable-0.3.0.exe` to run without installing.

Windows may show a "Windows protected your PC" message because the app is not code-signed. Click **More info → Run anyway**.

## Run from source (developers)

```
npm install
npm start          # run the app
npm test           # unit tests
npm run dist       # build the Windows installer into dist/
```

## Feature status

The app never fakes results. Each feature is either working, waiting for an external API key, or not built yet.

| Area | Status |
|---|---|
| Home dashboard, size search, custom sizes | ✅ Working |
| 42 design sizes from the spec (social, video, documents, print, merchandise) with correct dimensions | ✅ Working |
| 12 starter templates that adapt to any size (incl. an Urdu Eid greeting) | ✅ Working |
| Editor: text, shapes, 16 icons, lines and arrows, images | ✅ Working |
| Move, resize, rotate, flip, duplicate, delete, lock, hide | ✅ Working |
| Layers, grouping, arrange, align, distribute, snapping guides, grid | ✅ Working |
| Undo and redo, zoom and pan, keyboard shortcuts | ✅ Working |
| Text: fonts, size, weight, italic, underline, uppercase, alignment, spacing, outline, highlight box, shadow | ✅ Working |
| Urdu / Arabic right-to-left text | ✅ Working |
| Colours with transparency, gradients, page background colour, gradient or image | ✅ Working |
| Images: upload, drag and drop, paste, crop by frame, corner radius, border, brightness, contrast, saturation, blur, black and white, sepia | ✅ Working |
| Multi-page designs (add, duplicate, reorder, delete pages) | ✅ Working |
| Export PNG, JPEG (quality), SVG, PDF; transparent PNG; 1×–4× or 72–600 DPI; print bleed | ✅ Working |
| Projects: autosave, recent designs, folders, rename, duplicate, delete (to the Recycle Bin), open and save `.dstudio` files | ✅ Working |
| Manual resize to another format with content scaling | ✅ Working |
| AI image generation (OpenAI, Stability AI or Replicate) | 🔑 Phase 2, needs your API key |
| Magic Write, Magic Design, AI design assistant (Claude API) | 🔑 Phase 2, needs your API key |
| Background remover (runs on your PC) | ⏳ Phase 2 |
| Magic Resize (smart re-layout) | ⏳ Phase 2 |
| Presentation mode, transitions, PPTX export, whiteboard | ⏳ Phase 3 |
| Upload video clips (MP4, MOV, WebM, MKV, AVI, WMV) and audio (MP3, WAV, M4A, AAC, OGG, FLAC); unsupported formats are converted automatically | ✅ Working |
| Video timeline: pages are scenes with adjustable length, clips with trim, volume, mute and loop, music tracks with start time, trim, volume, fade in/out and repeat | ✅ Working |
| Video preview with sound, MP4 export (H.264 + AAC, full or reduced resolution) | ✅ Working |
| Asset library in **Elements**: search online photos, illustrations, vectors, video clips and music/sound effects, with a licence badge on every item (Free / Credit required) and a Credits list for the design | ✅ Working |
| Built-in offline library: 53 recolourable graphics (blobs, waves, badges, ribbons, mockups, Eid/Ramadan art…), 186 emoji stickers, 22 shapes, 69 icons, 16 photo frames, 9 line styles | ✅ Working |
| Animations: 12 entrance effects, 5 looping effects, and 6 scene transitions, played in preview and MP4 export | ✅ Working |
| Captions/subtitles, timeline split tool | ⏳ Phase 3 |

### Stock media sources

| Source | What | Key needed? | Licence |
|---|---|---|---|
| Openverse | Photos, illustrations, music, sound effects | No | Creative Commons. Only licences that allow commercial use and changes are shown. Items marked *Credit* need attribution. |
| Pexels | Photos, videos | Free key from pexels.com/api | Pexels License: free, no credit needed |
| Pixabay | Photos, illustrations, vectors, videos | Free key from pixabay.com/api/docs | Pixabay Content License: free, no credit needed |

Enter the keys under **Settings → Stock photos, videos & music**, or straight from the Elements panel.
| Website and Link-in-Bio builder | ⏳ Phase 3 |
| Brand Kit, stock asset library, version history, DOCX export | ⏳ Phase 4 |

## Roadmap

**Phase 1: Core Design Studio** ✅ (this release)

**Phase 2: AI Integration**
- Settings page for API keys, stored encrypted with Windows protection (Electron `safeStorage`) and never saved in project files.
- AI Image Generator: a provider setting for OpenAI, Stability AI or Replicate. Text-to-image and image-to-image, with results placed straight onto the canvas.
- Magic Write using the Claude API: write, rewrite, change tone, fix grammar, inside the text panel.
- Magic Design and the AI Design Assistant: Claude returns structured edit operations (JSON) that the editor applies through the same commands as the UI, so every change can be undone.
- Background remover: an on-device ONNX segmentation model, so photos are never uploaded.
- Magic Resize: re-layout rules on top of the existing manual resize.

**Phase 3: Creative Production Tools**
- Presentation mode with slide transitions, and PPTX export.
- Video Studio extras: transitions between scenes, animated text and elements, captions/subtitles, and a split tool on the timeline. Upload, timeline, music and MP4 export already work.
- Website and Link-in-Bio builder that exports a static website folder.

**Phase 4: Advanced Features**
- Brand Kit, version history, DOCX export, and keyframe animation.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
