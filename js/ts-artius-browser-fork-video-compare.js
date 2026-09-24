// obvpm fork: the video comparison uses the whole stage, gets a second layout
// -- "Split": the clips stacked in one box with a draggable vertical divider
// between each pair, so each clip shows in its own strip left to right (two
// clips = upstream's two-image comparison; three or four get two or three
// dividers) -- one compact controls row, and a Loop option.
// Upstream's compare setup only drives the <video> elements and the transport
// (sync, buffering, frame steps) and never looks at the layout, so all of this
// is CSS on a data attribute plus a divider; its sync engine is untouched.
const TS_FORK_COMPARE_KEY = "tsab.fork.videoCompare";
const TS_FORK_COMPARE_LOOP_KEY = "tsab.fork.videoCompareLoop";
const TS_FORK_COMPARE_LAYOUTS = [
    ["side", "fork.video.compare.side", "Side by Side", "fork.video.compare.side.hint", "The clips next to each other"],
    ["split", "fork.video.compare.split", "Split", "fork.video.compare.split.hint",
        "The clips on top of each other: drag the dividers to reveal each in its own strip"],
];

function tsReadLayout() {
    try {
        return window.localStorage.getItem(TS_FORK_COMPARE_KEY) === "split" ? "split" : "side";
    } catch {
        return "side";
    }
}

function tsReadLoop() {
    try {
        return window.localStorage.getItem(TS_FORK_COMPARE_LOOP_KEY) === "1";
    } catch {
        return false;
    }
}

function tsWriteLoop(tsOn) {
    try {
        window.localStorage.setItem(TS_FORK_COMPARE_LOOP_KEY, tsOn ? "1" : "0");
    } catch {
        // private mode: the choice still holds for this page
    }
}

function tsWriteLayout(tsLayout) {
    try {
        window.localStorage.setItem(TS_FORK_COMPARE_KEY, tsLayout);
    } catch {
        // private mode: the choice still holds for this page
    }
}

const TS_FORK_COMPARE_CSS = `
    /* obvpm fork: video comparison -- fill the stage */
    .ts-viewer .ts-video-compare-shell[data-fork-layout] {
        width: 100%;
        min-width: 0;
        min-height: 0;
        align-self: stretch;
        grid-template-rows: minmax(0, 1fr) auto;
        gap: 6px;
    }
    .ts-viewer .ts-video-compare-shell[data-fork-layout] .ts-video-compare-grid {
        position: relative;
        align-self: stretch;
        min-width: 0;
        min-height: 0;
        grid-auto-rows: minmax(0, 1fr);
        gap: 6px;
    }
    .ts-viewer .ts-video-compare-shell[data-fork-layout] .ts-video-compare-card {
        grid-template-rows: auto minmax(0, 1fr);
        min-height: 0;
    }
    /* size containment: the clip fills its cell, its pixel size pushes nothing */
    .ts-viewer .ts-video-compare-shell[data-fork-layout] .ts-video-compare-video {
        contain: size;
        width: 100%;
        height: 100%;
        max-width: none;
        max-height: none;
        align-self: stretch;
        justify-self: stretch;
        object-fit: contain;
        background: transparent;
    }

    /* Split: the cards stacked in the one cell, each clipped to its strip
       between two dividers (--ts-fork-l / --ts-fork-r, set per card) */
    .ts-viewer .ts-video-compare-shell[data-fork-layout="split"] .ts-video-compare-grid {
        display: block;
        cursor: ew-resize;
        touch-action: none;
        user-select: none;
        border-radius: 12px;
        overflow: hidden;
    }
    .ts-viewer .ts-video-compare-shell[data-fork-layout="split"] .ts-video-compare-card {
        position: absolute;
        inset: 0;
        display: block;
        --ts-fork-l: 0%;
        --ts-fork-r: 100%;
        clip-path: inset(0 calc(100% - var(--ts-fork-r)) 0 var(--ts-fork-l));
    }
    .ts-viewer .ts-video-compare-shell[data-fork-layout="split"] .ts-video-compare-video {
        position: absolute;
        inset: 0;
        border-radius: 0;
    }
    .ts-viewer .ts-video-compare-shell[data-fork-layout="split"] .ts-video-compare-label {
        position: absolute;
        top: 8px;
        left: calc(var(--ts-fork-l) + 8px);
        z-index: 1;
        max-width: calc(var(--ts-fork-r) - var(--ts-fork-l) - 16px);
        background: var(--ts-nav-surface);
        backdrop-filter: blur(8px);
    }
    .ts-viewer .ts-video-compare-shell[data-fork-layout="split"] .ts-video-compare-card:last-child .ts-video-compare-label {
        left: auto;
        right: 8px;
    }
    .ts-fork-compare-divider {
        display: none;
        position: absolute;
        top: 0;
        bottom: 0;
        z-index: 2;
        width: 2px;
        transform: translateX(-50%);
        background: var(--ts-accent);
        box-shadow: 0 0 0 1px var(--ts-playhead-shadow);
        pointer-events: none;
    }
    .ts-fork-compare-divider::after {
        content: "";
        position: absolute;
        top: 50%;
        left: 50%;
        width: 28px;
        height: 28px;
        border: 1px solid var(--ts-border);
        border-radius: 999px;
        transform: translate(-50%, -50%);
        background: var(--ts-nav-surface);
        backdrop-filter: blur(8px);
        box-shadow: 0 8px 24px var(--ts-playhead-shadow);
    }
    .ts-video-compare-shell[data-fork-layout="split"] .ts-fork-compare-divider {
        display: block;
    }

    /* one compact controls row: transport | frame steps | layout */
    .ts-viewer .ts-video-compare-shell[data-fork-layout] .ts-video-compare-controls {
        position: relative;
        width: 100%;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .ts-viewer .ts-video-compare-shell[data-fork-layout] .ts-video-transport {
        flex: 1 1 auto;
        min-width: 0;
    }
    .ts-viewer .ts-video-compare-shell[data-fork-layout] .ts-video-stepper {
        flex: none;
        flex-wrap: nowrap;
        gap: 4px;
    }
    .ts-viewer .ts-video-compare-shell[data-fork-layout] .ts-video-frame {
        min-width: 92px;
        padding: 5px 8px;
    }
    /* the buffering note floats over the clips instead of reserving a line */
    .ts-viewer .ts-video-compare-shell[data-fork-layout] .ts-video-compare-status {
        position: absolute;
        left: 50%;
        bottom: calc(100% + 10px);
        z-index: 3;
        transform: translateX(-50%);
        padding: 3px 10px;
        border: 1px solid var(--ts-border);
        border-radius: 999px;
        background: var(--ts-nav-surface);
        backdrop-filter: blur(8px);
        white-space: nowrap;
        pointer-events: none;
    }
    /* upstream's close button, moved from the top-right corner (where it
       covered the right clip's filename) to the end of the controls row */
    .ts-viewer .ts-video-compare-shell[data-fork-layout] .ts-video-compare-controls .ts-compare-close {
        position: static;
        flex: none;
        margin-left: auto;
        width: auto;
        min-width: 34px;
        height: auto;
        min-height: 30px;
        padding: 0 10px;
        border-radius: 8px;
        font-size: 20px;
        background: var(--ts-surface-ghost);
        backdrop-filter: none;
    }
    .ts-fork-compare-loop {
        flex: none;
        white-space: nowrap;
    }
    .ts-fork-compare-loop[data-active="true"] {
        border-color: var(--ts-accent);
        background: color-mix(in srgb, var(--ts-accent) 18%, var(--ts-bg-2));
    }
    .ts-fork-compare-layout {
        flex: none;
        display: inline-flex;
    }
    .ts-fork-compare-layout button {
        border-radius: 0;
        margin-left: -1px;
        white-space: nowrap;
    }
    .ts-fork-compare-layout button:first-child {
        border-radius: 8px 0 0 8px;
        margin-left: 0;
    }
    .ts-fork-compare-layout button:last-child {
        border-radius: 0 8px 8px 0;
    }
    .ts-fork-compare-layout button[data-active="true"] {
        position: relative;
        border-color: var(--ts-accent);
        background: color-mix(in srgb, var(--ts-accent) 18%, var(--ts-bg-2));
    }
    @media (max-width: 1080px) {
        .ts-viewer .ts-video-compare-shell[data-fork-layout] .ts-video-compare-controls {
            flex-wrap: wrap;
            justify-content: center;
        }
        .ts-viewer .ts-video-compare-shell[data-fork-layout] .ts-video-transport {
            flex-basis: 100%;
        }
    }
`;

export function tsInstallForkVideoCompare(tsPanel) {
    const tsViewer = tsPanel?.tsViewer;
    if (!tsViewer?.tsRefs?.tsStage || tsViewer.tsForkVideoCompareInstalled) {
        return;
    }
    tsViewer.tsForkVideoCompareInstalled = true;
    const tsStyle = document.createElement("style");
    tsStyle.textContent = TS_FORK_COMPARE_CSS;
    tsViewer.shadowRoot.append(tsStyle);

    let tsLayout = tsReadLayout();
    let tsLoop = tsReadLoop();

    const tsBindStageInteractions = tsViewer.tsBindStageInteractions;
    tsViewer.tsBindStageInteractions = function (...tsArgs) {
        const tsResult = tsBindStageInteractions.apply(this, tsArgs);
        const tsShell = this.tsRefs.tsStage.querySelector(".ts-video-compare-shell");
        const tsGrid = tsShell?.querySelector(".ts-video-compare-grid");
        const tsControls = tsShell?.querySelector(".ts-video-compare-controls");
        if (!tsShell || !tsGrid || !tsControls || tsShell.dataset.forkLayout) {
            return tsResult;
        }
        // a split needs at least two clips (upstream compares up to four)
        const tsCards = Array.from(tsGrid.querySelectorAll(".ts-video-compare-card"));
        const tsCanSplit = tsCards.length >= 2;
        const tsButtons = [];
        const tsPaint = () => {
            tsShell.dataset.forkLayout = tsCanSplit ? tsLayout : "side";
            for (const tsButton of tsButtons) {
                const tsActive = tsButton.dataset.layout === tsShell.dataset.forkLayout;
                tsButton.dataset.active = String(tsActive);
                tsButton.setAttribute("aria-pressed", String(tsActive));
            }
        };
        // Loop. Upstream stops the group in ONE place -- the primary clip's
        // `ended` pauses everything -- and already treats Play on a finished
        // group as "rewind all and replay". So looping is pressing its own
        // Play button once that has happened: the rewind, the re-sync and the
        // buffering hold all stay upstream's. Deferred, so it does not matter
        // whether this listener or upstream's runs first.
        const tsPlayToggle = tsControls.querySelector(".ts-video-play-toggle");
        const tsVideos = Array.from(tsGrid.querySelectorAll("video"));
        const tsPrimary = tsVideos.find((tsVideo) => tsVideo.dataset.primary === "true") || tsVideos[0];
        if (tsPlayToggle && tsPrimary) {
            const tsLoopButton = document.createElement("button");
            tsLoopButton.type = "button";
            tsLoopButton.className = "ts-video-step ts-fork-compare-loop";
            tsLoopButton.textContent = this.tsT("fork.video.compare.loop", "Loop");
            const tsPaintLoop = () => {
                tsLoopButton.dataset.active = String(tsLoop);
                tsLoopButton.setAttribute("aria-pressed", String(tsLoop));
                tsLoopButton.title = tsLoop
                    ? this.tsT("fork.video.compare.loop.on", "Looping: playback starts over when the clips end")
                    : this.tsT("fork.video.compare.loop.off", "Play once and stop at the end");
            };
            tsLoopButton.addEventListener("click", () => {
                tsLoop = !tsLoop;
                tsWriteLoop(tsLoop);
                tsPaintLoop();
            });
            tsPrimary.addEventListener("ended", () => {
                if (!tsLoop) {
                    return;
                }
                window.setTimeout(() => {
                    // still this stage, still at the end, still wanted
                    if (tsLoop && tsPlayToggle.isConnected && tsPrimary.ended) {
                        tsPlayToggle.click();
                    }
                }, 0);
            });
            tsPaintLoop();
            tsControls.append(tsLoopButton);
        }
        if (tsCanSplit) {
            // N clips: N-1 cuts (percent of the width, ascending); card i shows
            // between cut i-1 and cut i, and a divider sits on each cut
            const tsCount = tsCards.length;
            const tsMinStrip = 4;
            const tsCuts = tsCards.slice(1).map((tsCard, tsIndex) => ((tsIndex + 1) * 100) / tsCount);
            const tsDividers = tsCuts.map(() => {
                const tsDivider = document.createElement("div");
                tsDivider.className = "ts-fork-compare-divider";
                tsGrid.append(tsDivider);
                return tsDivider;
            });
            const tsApplyCuts = () => {
                tsCards.forEach((tsCard, tsIndex) => {
                    const tsLeft = tsIndex ? tsCuts[tsIndex - 1] : 0;
                    const tsRight = tsIndex < tsCount - 1 ? tsCuts[tsIndex] : 100;
                    tsCard.style.setProperty("--ts-fork-l", `${tsLeft.toFixed(2)}%`);
                    tsCard.style.setProperty("--ts-fork-r", `${tsRight.toFixed(2)}%`);
                });
                tsDividers.forEach((tsDivider, tsIndex) => {
                    tsDivider.style.left = `${tsCuts[tsIndex].toFixed(2)}%`;
                });
            };
            tsApplyCuts();

            const tsGroup = document.createElement("div");
            tsGroup.className = "ts-fork-compare-layout";
            tsGroup.setAttribute("role", "group");
            for (const [tsValue, tsKey, tsLabel, tsHintKey, tsHint] of TS_FORK_COMPARE_LAYOUTS) {
                const tsButton = document.createElement("button");
                tsButton.type = "button";
                tsButton.className = "ts-video-step";
                tsButton.dataset.layout = tsValue;
                tsButton.textContent = this.tsT(tsKey, tsLabel);
                tsButton.title = this.tsT(tsHintKey, tsHint);
                tsButton.addEventListener("click", () => {
                    tsLayout = tsValue;
                    tsWriteLayout(tsLayout);
                    tsPaint();
                });
                tsButtons.push(tsButton);
                tsGroup.append(tsButton);
            }
            tsControls.append(tsGroup);

            // drag anywhere over the clips: the nearest divider follows the
            // pointer, kept between its neighbours
            let tsDragIndex = -1;
            const tsShareAt = (tsEvent) => {
                const tsRect = tsGrid.getBoundingClientRect();
                if (!tsRect.width) {
                    return null;
                }
                return Math.max(0, Math.min(100, ((tsEvent.clientX - tsRect.left) / tsRect.width) * 100));
            };
            const tsMoveTo = (tsEvent) => {
                const tsShare = tsShareAt(tsEvent);
                if (tsShare === null || tsDragIndex < 0) {
                    return;
                }
                const tsLow = (tsDragIndex ? tsCuts[tsDragIndex - 1] : 0) + tsMinStrip;
                const tsHigh = (tsDragIndex < tsCuts.length - 1 ? tsCuts[tsDragIndex + 1] : 100) - tsMinStrip;
                tsCuts[tsDragIndex] = Math.max(tsLow, Math.min(tsHigh, tsShare));
                tsApplyCuts();
            };
            tsGrid.addEventListener("pointerdown", (tsEvent) => {
                if (tsShell.dataset.forkLayout !== "split" || tsEvent.button !== 0) {
                    return;
                }
                const tsShare = tsShareAt(tsEvent);
                if (tsShare === null) {
                    return;
                }
                tsDragIndex = tsCuts.reduce((tsBest, tsCut, tsIndex) =>
                    Math.abs(tsCut - tsShare) < Math.abs(tsCuts[tsBest] - tsShare) ? tsIndex : tsBest, 0);
                tsGrid.setPointerCapture?.(tsEvent.pointerId);
                tsEvent.preventDefault();
                tsMoveTo(tsEvent);
            });
            tsGrid.addEventListener("pointermove", (tsEvent) => {
                if (tsDragIndex >= 0) {
                    tsMoveTo(tsEvent);
                }
            });
            const tsStop = () => {
                tsDragIndex = -1;
            };
            tsGrid.addEventListener("pointerup", tsStop);
            tsGrid.addEventListener("pointercancel", tsStop);
            tsGrid.addEventListener("lostpointercapture", tsStop);
        }
        // Upstream's own close button (its click handler and label stay),
        // moved out of the corner where it sat over the right clip's name.
        // The stage is rebuilt by innerHTML, which detaches the button with
        // it; appending the same element again on each rebuild brings it
        // back, listener included.
        const tsClose = this.tsRefs.tsCompareCloseButton;
        if (tsClose) {
            tsControls.append(tsClose);
        }
        tsPaint();
        return tsResult;
    };
}
