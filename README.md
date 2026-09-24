## About this fork (obvpm)

This is a fork of [AlexYez/comfyui-artius-browser](https://github.com/AlexYez/comfyui-artius-browser) with additional features and tweaks. Everything below is on top of upstream 1.19.0. Upstream's README follows in English only; the other languages are in the upstream repo.

**Browser panel**

- Compact toolbar, reordered: Output, file types, Flat / Tree first, search last.
- **Recurse** toggle in Tree mode: off, the grid shows only the files in the selected folder, not its subfolders.
- Sort by **Modified** or **Created** instead of a single Date.
- **Filename pill** on every thumbnail (can be turned off in settings). Landscape thumbnails are centred between the hover bar and the pills.
- Settings popup behind a gear in the title row, holding Autoscan, Rebuild Cache, Show filenames and **Only show Assets** (hides the Assets / Workflows switch).
- **Compare** and **Delete** live in a bar under the grid that appears only when they can be used. Deleting more than one asset asks first.
- No outline around the panel on shift-click selection.

**Viewer**

- **Info** button (or the `I` key) hides the information panel so the image or video gets the full width. Remembered.
- Video size modes: **1:1**, **Fit** (default) and **Centered**.

**Video comparison**

- The clips fill the stage instead of a fixed box.
- **Split** view for two to four clips: all stacked, with a draggable divider between each pair so every clip shows in its own strip, like the two-image comparison.
- Playback and frame-step controls on one row, and a **Loop** option that replays the group when the clips end. The close button sits at the end of that row instead of over the right clip's name.

All fork preferences are kept in the browser's local storage; upstream's settings file is untouched.



---

# 🎨 Artius Browser for ComfyUI

**A fast, friendly sidebar for the files you actually use every day.**

![Version](https://img.shields.io/github/v/release/AlexYez/comfyui-artius-browser?style=flat-square&label=version&color=5fa14f)
![License](https://img.shields.io/github/license/AlexYez/comfyui-artius-browser?style=flat-square&color=8a7fc8)
![ComfyUI](https://img.shields.io/badge/ComfyUI-%E2%89%A50.19.0-blue?style=flat-square)
![Frontend](https://img.shields.io/badge/frontend-1.42.10%20%E2%80%93%201.48.7-blue?style=flat-square)
![Python](https://img.shields.io/badge/Python-3.10%2B-blue?style=flat-square&logo=python&logoColor=white)
![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square)

![Artius Browser](img/ts-artius-browser.jpg)

---

> **Artius Browser** lives in your ComfyUI sidebar and makes it painless to find,
> preview, drag, and load assets — images, videos, audio, 3D models, and
> workflow files. It stays fast on huge libraries and uses native ComfyUI
> behavior wherever it can.

### ✨ Highlights

|                                      |                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 🖼️ **Images**                       | Cached thumbnails, PNG prompt + workflow extraction, lightbox with wipe / 2×2 grid compare, zoomed in step                      |
| 🎬 **Videos**                        | Frame-stepping, codec / FPS / duration / audio info, embedded prompt + workflow, sync compare for 2-4 clips                     |
| 🎵 **Audio**                         | Waveform preview, transport controls, channel layout                                                                            |
| 🎲 **3D**                            | Native ComfyUI 3D viewer in the lightbox, captured 3D thumbnails                                                                |
| 📜 **Workflows**                     | Reads ComfyUI's native workflow folder, sidecar previews, drag-to-load                                                          |
| 🪟 **Two tabs**                      | `Assets` and `Workflows` with **independent** state (search, sort, view, preview size, tree-panel width)                        |
| 🔍 **Filename-first search**         | Fast and predictable by default; one toggle inside the search field extends it to prompts and model names                       |
| ⭐ **Favorites**                      | Star the keepers, filter the grid down to them — survives a full `Rebuild Cache`                                                |
| 🧬 **Model info**                    | Checkpoints, LoRAs and VAEs read from the PNG prompt, shown in the lightbox and searchable                                      |
| 🔎 **Click to 100%**                 | One click in the lightbox jumps to true pixel scale, with a navigator minimap for panning                                       |
| 🚀 **Drag-and-drop**                 | Direct into native `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` nodes                                                     |
| 🗑️ **Safe delete**                  | Sends to system trash via `send2trash` — never hard-delete                                                                      |
| 🔄 **Autoscan / Rebuild Cache**      | Refresh on demand, or rebuild from scratch                                                                                      |
| 🏷️ **Version label + update badge** | Current version next to the title; checks GitHub once a day, surfaces a `New version available` chip when a newer release ships |
| 🧲 **Multi-select drag**             | Drag a whole selection onto the canvas — one native node per asset, auto-arranged in a grid                                     |
| 🔔 **Action feedback**               | Toast notifications when a copy / delete / load / rescan succeeds or fails — no more silent failures                            |
| 🌍 **Localized UI**                  | Follows ComfyUI's own language setting — English, Russian, Chinese and Japanese ship today                                      |
| ♿ **Accessible grid**                | Screen-reader listbox semantics with selection state, plus a keyboard focus ring                                                |

### 📁 Supported formats

- 🖼️ Images: `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif`
- 🎬 Videos: `.mp4` · `.mov` · `.webm` · `.prores`
- 🎵 Audio: `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D: `.glb` · `.obj`
- 📜 Workflows: `.json`

### 🚀 Quick start

#### Recommended — via Comfy Registry

```bash
comfy node install timesaver-artius-browser
```

…or search **Timesaver Artius Browser** in **ComfyUI Manager**.

#### Manual install

```bash
git clone https://github.com/AlexYez/comfyui-artius-browser \
  ComfyUI/custom_nodes/comfyui-artius-browser
pip install -r ComfyUI/custom_nodes/comfyui-artius-browser/requirements.txt
```

Then **restart ComfyUI** and **hard refresh** the browser with `Ctrl+F5`.

> 💡 **FFmpeg** (`ffmpeg` + `ffprobe`) powers video/audio metadata and the audio waveforms — optional (ComfyUI still starts without it), but recommended:
> 
> - **Windows:** `winget install ffmpeg` (or `choco install ffmpeg`)
> - **macOS:** `brew install ffmpeg`
> - **Linux:** `sudo apt install ffmpeg`
> 
> Restart ComfyUI after installing, then verify with `ffmpeg -version`.

### ⌨️ Keyboard & card actions

#### Keyboard — asset grid

| Key                                                 | Action                                                            |
|:---------------------------------------------------:| ----------------------------------------------------------------- |
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Move the selection                                                |
| <kbd>Enter</kbd>                                    | Open the lightbox *(or load the workflow in the `Workflows` tab)* |

#### Keyboard — lightbox

| Key                       | Action                                                       |
|:-------------------------:| ------------------------------------------------------------ |
| <kbd>Esc</kbd>            | Close                                                        |
| <kbd>←</kbd> <kbd>→</kbd> | Previous / next asset *(steps frames in video compare mode)* |
| <kbd>↑</kbd> <kbd>↓</kbd> | Step one video frame                                         |
| <kbd>Delete</kbd>         | Send to system trash                                         |

#### Card buttons

> These are **buttons on the card** (hover to reveal), not keyboard keys.

| Button  | Action                                                                                                                                                     |
|:-------:| ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `P`     | Copy prompt                                                                                                                                                |
| `W`     | Copy workflow *(only when the PNG actually has workflow data)*                                                                                             |
| `D`     | Download                                                                                                                                                   |
| `X`     | Send to system trash *(only where the root allows deletion)*                                                                                               |
| `S` `R` | Appear only when another installed pack publishes an action for the asset (e.g. TS Image Studio: *use in the studio* / *restore the session that made it*) |

#### Workflow card buttons

| Button             | Action                                     |
|:------------------:| ------------------------------------------ |
| `L` · double-click | Load workflow into ComfyUI                 |
| `D`                | Download workflow JSON                     |
| `X`                | Trash workflow + matching preview sidecars |

### 🎯 Native ComfyUI integration

This pack doesn't reinvent loaders — it routes drag-and-drop to native nodes:

| Asset type | Native node                      |
| ---------- | -------------------------------- |
| Image      | `LoadImage`                      |
| Video      | `LoadVideo`                      |
| Audio      | `LoadAudio`                      |
| 3D         | `Load 3D & Animation` / `Load3D` |
| Workflow   | Native frontend workflow loader  |

3D files are staged into ComfyUI input storage so the native 3D nodes see them
exactly like files picked from the node UI. The `Workflows` tab reads
`user/default/workflows` directly — no separate cache, no parallel index.

When another installed pack publishes a better loader, it wins: a video dropped on the canvas becomes a **TS Video Loader** node (from `comfyui-timesaver`) reading the file where it already sits, instead of a copy landing in `input/`. Without that pack, the native node is created exactly as above.

### 🔬 Lightbox tour

<details>
<summary><strong>🖼️ Images</strong></summary>

- Mouse-wheel zoom, left/middle-button pan
- 2-image **wipe** compare with a left-to-right slider
- 4-image **2×2 grid** compare
- Separate `Prompt` and `Negative Prompt` panels
- One-click `Copy Workflow` when the PNG carries it
- Open in new tab, download, delete

</details>

<details>
<summary><strong>🎬 Videos</strong></summary>

- Inline playback with current-frame display
- ⬅️ / ➡️ frame-stepping
- Codec, FPS, duration, bitrate, format, audio-track info
- Sync compare for 2, 3 or 4 selected videos with one shared transport (**Compare** button in the toolbar)

</details>

<details>
<summary><strong>🎵 Audio</strong></summary>

- Waveform preview
- Playback controls
- Duration · bitrate · codec · channel layout

</details>

<details>
<summary><strong>🎲 3D</strong></summary>

- Native ComfyUI 3D viewer in-lightbox
- Technical model info in the sidebar
- No fake texture-sheet stand-in — it's the real thing

</details>

### 🧠 PNG metadata rules

- **Prompt** is read **only** from the PNG `Prompt` field
- **Workflow** is read **only** from the PNG `Workflow` field
- Positive and negative prompts are split before display
- If positive and negative are identical, only the positive is shown
- **Seed** is read from the PNG `Prompt` field and shown in the lightbox (copyable)

### 🛡️ Compatibility & safety

- Drag-and-drop graph access goes through a thin Comfy adapter — current
  canvas APIs preferred, legacy `LiteGraph` paths isolated.
- Asset search is filename-focused. Unsupported `metadata` query params
  return `400 Bad Request` instead of silently doing nothing.
- Asset listing pagination is **keyset-based** (`after_sort` + `after_id`);
  deep pages are O(1) regardless of library size.
- Companion images (PNG sidecars whose stem matches a sibling video / audio
  / 3D asset) are suppressed via a stored flag, not a query-time subquery.
- Frontend listeners are explicitly torn down on stage close / worker stop.

### ⚡ Performance notes

- Filename-only search · compact metadata · compact preview cache
- Virtualized grid · keyset pagination · stale-while-revalidate response cache
  *(LRU 10, 30 s TTL)* for instant filter / sort re-toggles
- Frontend-only workflow browsing · frontend-generated 3D thumbnails persisted to disk
- `ffprobe` + `ffmpeg` run **in parallel per asset** (single Popen pair)
- Worker pools default to `max(1, min(4, cpu_count() // 2))` — tweak in `config.json`
- Video poster: ffmpeg pre-downscales the captured frame so PIL only LANCZOS-finishes a small image
- WebP previews are written with `method=0` (fastest, visually identical at thumbnail sizes)
- Preview URLs carry the cached file's `mtime` as a cache-buster — no hard refresh after Rebuild Cache
- Optional accelerators:
  - 🚀 `Pillow-SIMD` — drop-in Pillow replacement, **4–6×** faster image thumbnailing
  - 🚀 `blake3` — already in `requirements.txt`, avoids the slower `blake2b` fallback

### 🆘 Troubleshooting

<details>
<summary><strong>Some previews look stale</strong></summary>

Hit **Rebuild Cache**. Preview URLs auto-bust the browser cache via an `mtime` token, so a hard refresh is usually unnecessary. If it still looks stale, restart ComfyUI and `Ctrl+F5`.

</details>

<details>
<summary><strong>Video or audio metadata is missing</strong></summary>

You probably don't have `ffmpeg` / `ffprobe` on `PATH`. Install them and restart.

</details>

<details>
<summary><strong>I want a complete reset</strong></summary>

Delete `ComfyUI/output/.ts_artius_browser/`, restart ComfyUI, scan again. All previews and indexes will rebuild.

</details>

### 🗂️ Runtime layout

```
ComfyUI/output/.ts_artius_browser/
├── db.sqlite          # asset index
├── config.json        # UI + tools settings
└── cache/
    ├── thumbnails/
    ├── video_frames/
    ├── waveforms/
    └── placeholders/
```

### 📋 Changelog

See [CHANGELOG.md](CHANGELOG.md). Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

Made with ❤️ by [AlexYez](https://github.com/AlexYez) ·
[🐛 Report a bug](https://github.com/AlexYez/comfyui-artius-browser/issues/new?template=bug.yml) ·
[💖 Donate](https://timesavervfx.com/donate/)
