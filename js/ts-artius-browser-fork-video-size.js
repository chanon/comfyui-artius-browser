// obvpm fork: how large a single video is shown in the viewer. Three modes on
// the row of the previous / next frame buttons, remembered:
//   fit      the video grows or shrinks to the stage, leaving room for the controls
//   native   1:1, one screen pixel per video pixel, scrolls when it is larger
//   centered upstream's fixed box (its rules are left alone)
// The stage is rebuilt as markup on every render, so the <video> gets its
// wrapper IN THE MARKUP (moving a playing video in the DOM would pause it) and
// the buttons are added again after each render.
const TS_FORK_VIDEO_SIZE_KEY = "tsab.fork.videoSize";
const TS_FORK_VIDEO_SIZE_MODES = [
    ["native", "fork.video.size.native", "1:1", "fork.video.size.native.hint", "Original size (scrolls when larger than the window)"],
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
    .ts-video-shell[data-fork-size="fit"],
    .ts-video-shell[data-fork-size="native"] {
        width: 100%;
        min-width: 0;
        min-height: 0;
        align-self: stretch;
        grid-template-rows: minmax(0, 1fr) auto;
    }
    /* The box is sized by the stage ONLY: size containment stops the video's
       own pixel size from pushing the row (and the whole stage) larger. */
    .ts-video-shell[data-fork-size="fit"] .ts-fork-video-box,
    .ts-video-shell[data-fork-size="native"] .ts-fork-video-box {
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
    .ts-video-shell[data-fork-size="native"] .ts-fork-video-box {
        overflow: auto;
    }
    .ts-video-shell[data-fork-size="native"] video {
        flex: none;
        width: auto;
        height: auto;
        max-width: none;
        max-height: none;
        margin: auto;
    }
    @media (max-width: 1080px) {
        /* upstream stacks the info panel under the stage here, in content-sized
           rows: a contained box has no content size, so the stage's row gets
           one (the info panel scrolls, so it is the one that gives way) */
        .ts-stage-wrap:has(.ts-video-shell[data-fork-size="fit"]),
        .ts-stage-wrap:has(.ts-video-shell[data-fork-size="native"]) {
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
    const tsPaint = () => {
        const tsShell = tsViewer.tsRefs.tsStage.querySelector(".ts-video-shell");
        if (!tsShell) {
            return;
        }
        tsShell.dataset.forkSize = tsMode;
        for (const tsButton of tsShell.querySelectorAll(".ts-fork-video-size button")) {
            const tsActive = tsButton.dataset.mode === tsMode;
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
                const tsButton = document.createElement("button");
                tsButton.type = "button";
                tsButton.className = "ts-video-step";
                tsButton.dataset.mode = tsValue;
                tsButton.textContent = this.tsT(tsKey, tsLabel);
                tsButton.title = this.tsT(tsHintKey, tsHint);
                tsButton.addEventListener("click", () => {
                    tsMode = tsValue;
                    tsWriteMode(tsMode);
                    tsPaint();
                });
                tsGroup.append(tsButton);
            }
            tsControls.append(tsGroup);
        }
        tsPaint();
        return tsResult;
    };
}
