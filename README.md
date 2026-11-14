## About this fork (obvpm)

This is a fork of [AlexYez/comfyui-artius-browser](https://github.com/AlexYez/comfyui-artius-browser) with additional features and tweaks. Everything below is on top of upstream 1.20.3. Upstream's README follows; its guides are in [guides/](guides/README.md).

**Browser panel**

- Compact toolbar, reordered: Input | Output, file types, Flat / Tree first; thumbnail size slider, Rescan and search last. Narrow sort and Flat / Tree menus, a shorter slider and a search field that stays on the first row longer.
- **Input | Output** as two buttons instead of a dropdown (can be turned off in settings, which brings the dropdown back with All).
- **Flat / Tree** as a dropdown instead of two buttons, to save space.
- Input and Output each **remember their own settings**: file types, Flat / Tree, Recurse, sort order, Favorites and filters.
- **Hide 3D**: the 3D file type is hidden (on by default, can be turned off in settings).
- **Recurse** toggle in Tree mode: off, the grid shows only the files in the selected folder, not its subfolders.
- **Length** filter (min / max seconds, decimals allowed) in the Filters row, after Width and Height: shows the videos and audio files whose length is in that range, both ends included. Images have no length, so they are hidden while a length is set. Kept per root like the other filters. Needs a restart of ComfyUI (the server does the filtering).
- Sort by **Modified** or **Created** instead of a single Date.
- **Filename pill** on every thumbnail (can be turned off in settings). Landscape thumbnails are centred between the hover bar and the pills.
- Settings popup behind a gear in the title row, holding Autoscan, Rebuild Cache, Show filenames, **Only show Assets** (hides the Assets / Workflows switch), **Hide 3D** and **Input / Output as a toggle**.
- The **filename search finds any part of a name**: every space-separated part of what you type must appear somewhere in the name, so text from the middle of a name, and names with a lone `+` or `-` in them, are found (upstream matched only whole words or their start). Needs a restart of ComfyUI.
- **Multiple** (a pill in the search field): a box for one file name per line, or any part of one; the grid shows every file that contains any line, as you type, and the row says which names were not found. A pasted path keeps only its file name. **Select all** there, or **Ctrl+A** anywhere in the panel outside a text box, selects every file listed (loading the rest of the list first), in the order of the names, so Compare shows the clips in that order. Needs a restart of ComfyUI.
- **Ctrl+C / Ctrl+V work in the panel's text boxes** (search, Multiple, filters): ComfyUI took copies over to copy nodes (the clipboard stayed empty) and could paste nodes or images onto the canvas; the panel now keeps its text boxes' clipboard to itself.
- Upstream's **Prompt** pill (search inside prompts and model names) is hidden unless **Show Prompt search** is on in settings (off by default); hidden, the search looks at filenames only.
- A new **search keeps what is selected**: search a clip and click it, search another and Ctrl-click it, then Compare. The first clip picked comes first. The bar says how many selected clips are not in the current list, and names them on hover. A plain click, Esc or the bar's x clears them; a new folder, type, filter or sort clears the selection as before.
- **Compare**, **Download** (upstream's Download Selected: one ZIP) and **Delete** live in a bar under the grid that appears only when they can be used.
- Confirmations (deleting more than one asset, Rebuild Cache) appear in **ComfyUI's own dialog**, so they also work in ComfyUI Desktop, which does not show the browser's.
- No outline around the panel on shift-click selection.
- **New files show up by themselves**: the server watches the asset folders for file changes (Windows; no polling) and rescans a folder once it has been quiet for 1.5 s, so a render still being written is picked up once, when it is done. Clicking a folder rescans just that folder. Both follow the Autoscan setting. A rescan that finds nothing changes nothing on screen. Not on Windows, new files show up after a generation, a folder click or Rescan.
- **Faster rescans**: a file whose thumbnail could not be made (an empty or unreadable video) is no longer processed again on every scan, which held each rescan at "Indexing changed assets 0 / N"; clips shorter than half a second get their first frame as the thumbnail; the progress count updates while it runs.
- The scan **progress bar floats over the bottom of the grid** instead of pushing the toolbar down.
- In a narrow panel the thumbnails start right under the folder tree, and the **line between them can be dragged** to make the tree taller or shorter. Remembered.

**Viewer**

- **Info** button (or the `I` key) hides the information panel so the image or video gets the full width. Remembered.
- A video plays with the comparison's **play bar** instead of the browser's own controls: Play / Pause, seek bar, time, volume, upstream's first / last frame buttons, frame steps and **Loop**, the size buttons and **Full Screen** (the video and its bar fill the screen; Esc comes back). A click on the picture or Space plays / pauses. On a narrow player the play / seek / time / volume part gets a line of its own. A click that just misses the bar (below it or beside it) no longer closes the video; a click beside the picture above the bar still does.
- Video zoom: mouse wheel up zooms in at the cursor, wheel down zooms back out and stops at Fit; drag with the middle mouse button to move around a zoomed video. **1:1**, **Fit** (default) and **Centered** buttons with the zoom shown next to them (1:1 is remembered for the next video), and upstream's `+` `-` `0` `1` keys work too. The play bar stays the same size while zoomed. Needs a Chromium browser (Chrome, Edge); elsewhere the 1:1 button is hidden and there is no zoom.
- The **volume** (and mute) is remembered (upstream's setting): every video, and every comparison, starts at the level you last set in either.
- **Click the filename** above the image or video to copy it.

**Video comparison**

- The clips fill the stage, with each name on its own row above its clip. This comparison stays in place of upstream's newer one: **Split** below instead of its Wipe.
- **Up to six clips** (upstream four), laid out 3 x 2 when there are five or six; images too.
- **Split** view for two to six clips: all stacked, with a draggable divider between each pair so every clip shows in its own strip, like the two-image comparison. The dividers can come almost together (a strip keeps 0.5% of the width); where they meet, the first move decides which one moves.
- The same zoom for the comparison: every clip zooms and moves together so they always show the same part of the frame, with **Fit** / **1:1** buttons in the controls row (1:1 is exact for the left-most clip, and follows when you drag another one to the front; the others are shown at the same size relative to their own Fit). Works in Side by Side and Split.
- **Drag a clip's name** to change the order of the clips (Side by Side and Split; playback carries on). A new comparison starts in the grid's order. **Click** a clip's name (without dragging) to copy its file name.
- The **x** after a clip's name takes it out of the comparison; it stays selected in the panel. The others go on from the same moment (still playing if they were, in full screen if it was); the clip with the sound stays, or the left-most one takes over. With one clip left it shows on its own.
- Clips with the **same file name** show their folders in front of the name, back to the first folder where they differ (`base/clip_00001.mp4`, `fl2va/clip_00001.mp4`); the tooltip has the full path.
- Playback and frame-step controls on one row, with upstream's **Loop** after the frame steps. The close button sits at the end of that row instead of over the right clip's name.
- **Volume**: a speaker button (mute) and a slider after the time, in place of upstream's Mute button, for the clip you opened the comparison from (the others are silent, as upstream).
- **Full Screen** button next to Fit / 1:1: the clips and the controls row fill the screen. Esc (or the button) comes back to the viewer without closing it.

All fork preferences are kept in the browser's local storage; upstream's settings file is untouched.

---

# Artius Browser for ComfyUI

Browse images, videos, audio, 3D assets and workflows from the ComfyUI sidebar. Preview and compare assets, inspect their metadata, and drag them into native loader nodes.

**Start here:** [User guides](guides/README.md) · [Русское руководство](guides/ru.md) · [Integration API](INTEGRATION.md) · [Release history](CHANGELOG.md)

## Install and run

Find **Timesaver Artius Browser** in ComfyUI Manager, or install manually:

```bash
git clone https://github.com/AlexYez/comfyui-artius-browser ComfyUI/custom_nodes/comfyui-artius-browser
pip install -r ComfyUI/custom_nodes/comfyui-artius-browser/requirements.txt
```

The command above uses an example ComfyUI installation directory. Restart ComfyUI, hard-refresh the page with `Ctrl+F5`, then open **Browser** in the sidebar. FFmpeg and ffprobe are optional but needed for video/audio probing and previews; see the [English guide](guides/en.md).

There is no separate frontend build: ComfyUI serves the JavaScript modules directly. Package requirements and Registry identity live in [pyproject.toml](pyproject.toml).

## What it does

- **Assets and Workflows** have independent search, view and preview settings.
- **Images:** prompt/workflow inspection, zoom, wipe comparison and a comparison grid.
- **Videos:** shared playback and frame stepping; two-video comparison switches between side-by-side and wipe.
- **Autoscan:** completed generations index their named output files while the queue continues. Full-directory fallback scans wait for an idle queue.
- **Library actions:** favorites, native drag-and-drop, downloads and deletion to the system trash.
- **Language:** follows ComfyUI without a page reload; complete English, Russian, Simplified Chinese and Japanese dictionaries.

Search matches filenames by default; the **Prompt** toggle also searches prompt/model text. The [guides](guides/README.md) cover formats, shortcuts, filters and troubleshooting. Local-only drafts are labelled there; the published behavior is recorded in the [changelog](CHANGELOG.md).

## Repository map and development

| Entry | Purpose |
|---|---|
| [__init__.py](__init__.py) | ComfyUI extension entry point; no custom loader nodes |
| [tsab/](tsab/) | Python routes, indexing, metadata, storage and previews |
| [js/](js/) | Sidebar, media viewers, native integration and localization |
| [INTEGRATION.md](INTEGRATION.md) | Stable contracts for other node packs |
| [.github/workflows/](.github/workflows/) | Public CI and Registry publishing |

Public CI checks Python syntax/lint, JavaScript syntax and release metadata/localization. A version change on `main` triggers the gated Registry publish workflow; publishing requires maintainer credentials.

The owner's full development checkout also contains private `AGENTS.md`, `CLAUDE.md`, `doc/README.md`, `project_memory/MEMORY.md`, `scripts/` and `tests/`. These are intentionally excluded from the public repository. Start with `AGENTS.md` there: it links architecture, build/test/run/release instructions, configuration/log locations and failure diagnosis. The full local gate is `python scripts/check_release.py`; its scripts and test suites are not included in a public clone.

Keep filesystem containment, trash-only deletion, stable native integration and separate Assets/Workflows state intact. For a typical missing-output problem, check Autoscan, the selected root and active filters, then use **Rescan**; collect [diagnostics](guides/README.md#diagnostics) if the failure persists.

## License

[MIT](LICENSE.txt). [Repository and issue tracker](https://github.com/AlexYez/comfyui-artius-browser).
