// obvpm fork: how large a single video is shown in the viewer. Three buttons on
// the row of the previous / next frame buttons, remembered:
//   fit      the video grows or shrinks to the stage, leaving room for the controls
//   native   1:1, one screen pixel per video pixel: the stage-filling layout of
//            Fit, zoomed (the video zoom feature) -- drag with the middle
//            button when it is larger than the stage
//   centered upstream's fixed box (its rules are left alone)
// Wheel zoom works in Fit and Centered alike; Fit / 1:1 light up when the zoom
// is at exactly that size (the zoom feature reports every change).
// The stage is rebuilt as markup on every render, so the <video> gets its
// wrapper IN THE MARKUP (moving a playing video in the DOM would pause it) and
// the buttons are added again after each render.
const TS_FORK_VIDEO_SIZE_KEY = "tsab.fork.videoSize";
const TS_FORK_VIDEO_SIZE_MODES = [
    ["native", "fork.video.size.native", "1:1", "fork.video.size.native.hint", "Original size: one video pixel per screen pixel (middle-drag to move around)"],
    ["fit", "fork.video.size.fit", "Fit", "fork.video.size.fit.hint", "Fit the window, leaving room for the controls"],
    ["centered", "fork.video.size.centered", "Centered", "fork.video.size.centered.hint", "Centered at a fixed size"],
];
const TS_FORK_VIDEO_SIZE_DEFAULT = "fit";

function tsReadMode() {
    try {
        const tsStored = window.localStorage.getItem(TS_FORK_VIDEO_SIZE_KEY);
        return TS_FORK_VIDEO_SIZE_MODES.some(([tsMode]) => tsMode === tsStored) ? tsStored : TS_FORK_VIDEO_SIZE_DEFAULT;
    } catch {
        return TS_FORK_VIDEO_SIZE_DEFAULT;
    }
}

function tsWriteMode(tsMode) {
    try {
        window.localStorage.setItem(TS_FORK_VIDEO_SIZE_KEY, tsMode);
    } catch {
        // private mode: the choice still holds for this page
    }
}

const TS_FORK_VIDEO_SIZE_CSS = `
    /* obvpm fork: video size modes */
    .ts-fork-video-box {
        display: contents;
    }
    .ts-video-shell[data-fork-size="fit"] {
        width: 100%;
        min-width: 0;
        min-height: 0;
        align-self: stretch;
        grid-template-rows: minmax(0, 1fr) auto;
    }
    /* The box is sized by the stage ONLY: size containment stops the video's
       own pixel size from pushing the row (and the whole stage) larger. */
    .ts-video-shell[data-fork-size="fit"] .ts-fork-video-box {
        display: flex;
        position: relative;
        contain: size;
        /* upstream's shell centers its items: a contained box would be 0 high */
        align-self: stretch;
        justify-self: stretch;
        min-width: 0;
        min-height: 0;
    }
    .ts-video-shell[data-fork-size="fit"] video {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        max-height: none;
        object-fit: contain;
        background: transparent;
    }
    @media (max-width: 1080px) {
        /* upstream stacks the info panel under the stage here, in content-sized
           rows: a contained box has no content size, so the stage's row gets
           one (the info panel scrolls, so it is the one that gives way) */
        .ts-stage-wrap:has(.ts-video-shell[data-fork-size="fit"]) {
            min-height: 55vh;
        }
    }
    .ts-fork-video-size {
        display: inline-flex;
        margin-left: 8px;
    }
    .ts-fork-video-size button {
        border-radius: 0;
        margin-left: -1px;
    }
    .ts-fork-video-size button:first-child {
        border-radius: 8px 0 0 8px;
        margin-left: 0;
    }
    .ts-fork-video-size button:last-child {
        border-radius: 0 8px 8px 0;
    }
    .ts-fork-video-size button[data-active="true"] {
        position: relative;
        border-color: var(--ts-accent);
        background: color-mix(in srgb, var(--ts-accent) 18%, var(--ts-bg-2));
    }
`;

const TS_FORK_VIDEO_MARKUP = /(<div class="ts-video-shell">\s*)(<video\b[^>]*><\/video>)/;

export function tsInstallForkVideoSize(tsPanel) {
    const tsViewer = tsPanel?.tsViewer;
    if (!tsViewer?.tsRefs?.tsStage || tsViewer.tsForkVideoSizeInstalled) {
        return;
    }
    tsViewer.tsForkVideoSizeInstalled = true;
    const tsStyle = document.createElement("style");
    tsStyle.textContent = TS_FORK_VIDEO_SIZE_CSS;
    tsViewer.shadowRoot.append(tsStyle);

    let tsMode = tsReadMode();
    // what the zoom last reported for the video on screen (null: nothing yet,
    // or no zoom in this browser -- then the remembered button is lit)
    let tsZoomState = null;
    const tsZoomOn = () => tsViewer.tsForkVideoZoomSupported === true;
    // 1:1 is the Fit layout, zoomed
    const tsLayout = () => (tsMode === "centered" ? "centered" : "fit");
    const tsPaint = () => {
        const tsShell = tsViewer.tsRefs.tsStage.querySelector(".ts-video-shell");
        if (!tsShell) {
            return;
        }
        tsShell.dataset.forkSize = tsLayout();
        for (const tsButton of tsShell.querySelectorAll(".ts-fork-video-size button")) {
            // without the zoom a remembered 1:1 shows as Fit
            let tsActive = tsButton.dataset.mode === (tsMode === "native" && !tsZoomOn() ? "fit" : tsMode);
            if (tsZoomState && tsMode !== "centered") {
                tsActive = tsButton.dataset.mode === "fit" ? tsZoomState.tsAtFit
                    : tsButton.dataset.mode === "native" ? tsZoomState.tsAtNative : false;
            }
            tsButton.dataset.active = String(tsActive);
            tsButton.setAttribute("aria-pressed", String(tsActive));
        }
    };

    const tsBuildStageMarkup = tsViewer.tsBuildStageMarkup;
    tsViewer.tsBuildStageMarkup = function (...tsArgs) {
        const tsMarkup = tsBuildStageMarkup.apply(this, tsArgs);
        return typeof tsMarkup === "string"
            ? tsMarkup.replace(TS_FORK_VIDEO_MARKUP, '$1<div class="ts-fork-video-box">$2</div>')
            : tsMarkup;
    };

    const tsBindStageInteractions = tsViewer.tsBindStageInteractions;
    tsViewer.tsBindStageInteractions = function (...tsArgs) {
        const tsResult = tsBindStageInteractions.apply(this, tsArgs);
        const tsStage = this.tsRefs.tsStage;
        const tsControls = tsStage.querySelector(".ts-video-shell .ts-video-controls");
        // without the wrapper (upstream changed its markup) the modes cannot work
        if (tsControls && tsStage.querySelector(".ts-fork-video-box") && !tsControls.querySelector(".ts-fork-video-size")) {
            const tsGroup = document.createElement("div");
            tsGroup.className = "ts-fork-video-size";
            tsGroup.setAttribute("role", "group");
            for (const [tsValue, tsKey, tsLabel, tsHintKey, tsHint] of TS_FORK_VIDEO_SIZE_MODES) {
                // 1:1 is a zoom level: without the zoom it has nothing to do
                if (tsValue === "native" && !tsZoomOn()) {
                    continue;
                }
                const tsButton = document.createElement("button");
                tsButton.type = "button";
                tsButton.className = "ts-video-step";
                tsButton.dataset.mode = tsValue;
                tsButton.textContent = this.tsT(tsKey, tsLabel);
                tsButton.title = this.tsT(tsHintKey, tsHint);
                tsButton.addEventListener("click", () => {
                    tsMode = tsValue;
                    tsWriteMode(tsMode);
                    const tsZoom = this.tsForkVideoZoom;
                    if (tsValue === "native") {
                        // the layout first: 1:1 is measured on the Fit box
                        tsPaint();
                        tsZoom?.tsNative();
                    } else {
                        // back to Fit before Centered, so its held size is let go
                        tsZoom?.tsFit();
                    }
                    tsPaint();
                });
                tsGroup.append(tsButton);
            }
            tsControls.append(tsGroup);
        }
        const tsShell = tsStage.querySelector(".ts-video-shell");
        if (tsShell) {
            tsZoomState = null;
            // a remembered 1:1 opens the next video at 1:1 (the zoom reads this)
            tsShell.dataset.forkZoomStart = tsMode === "native" ? "native" : "";
            tsShell.addEventListener("ts-fork-video-zoom", (tsEvent) => {
                tsZoomState = tsEvent.detail;
                tsPaint();
            });
        }
        tsPaint();
        return tsResult;
    };
}
