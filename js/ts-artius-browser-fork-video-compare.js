// obvpm fork: the video comparison uses the whole stage, gets a second layout
// for two clips -- "Split": both clips stacked, a draggable vertical divider
// shows the first on its left and the second on its right, like upstream's
// two-image comparison -- and one compact controls row.
// Upstream's compare setup only drives the <video> elements and the transport
// (sync, buffering, frame steps) and never looks at the layout, so all of this
// is CSS on a data attribute plus a divider; its sync engine is untouched.
const TS_FORK_COMPARE_KEY = "tsab.fork.videoCompare";
const TS_FORK_COMPARE_LAYOUTS = [
    ["side", "fork.video.compare.side", "Side by Side", "fork.video.compare.side.hint", "The clips next to each other"],
    ["split", "fork.video.compare.split", "Split", "fork.video.compare.split.hint",
        "The clips on top of each other: drag the divider to reveal one on each side"],
];

function tsReadLayout() {
    try {
        return window.localStorage.getItem(TS_FORK_COMPARE_KEY) === "split" ? "split" : "side";
    } catch {
        return "side";
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

    /* Split: both cards stacked in the one cell, each clipped to its side */
    .ts-viewer .ts-video-compare-shell[data-fork-layout="split"] .ts-video-compare-grid {
        display: block;
        --ts-fork-wipe: 50%;
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
        clip-path: inset(0 calc(100% - var(--ts-fork-wipe)) 0 0);
    }
    .ts-viewer .ts-video-compare-shell[data-fork-layout="split"] .ts-video-compare-card + .ts-video-compare-card {
        clip-path: inset(0 0 0 var(--ts-fork-wipe));
    }
    .ts-viewer .ts-video-compare-shell[data-fork-layout="split"] .ts-video-compare-video {
        position: absolute;
        inset: 0;
        border-radius: 0;
    }
    .ts-viewer .ts-video-compare-shell[data-fork-layout="split"] .ts-video-compare-label {
        position: absolute;
        top: 8px;
        left: 8px;
        z-index: 1;
        max-width: 45%;
        background: var(--ts-nav-surface);
        backdrop-filter: blur(8px);
    }
    .ts-viewer .ts-video-compare-shell[data-fork-layout="split"] .ts-video-compare-card + .ts-video-compare-card .ts-video-compare-label {
        left: auto;
        right: 8px;
    }
    .ts-fork-compare-divider {
        display: none;
        position: absolute;
        top: 0;
        bottom: 0;
        left: var(--ts-fork-wipe);
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

    const tsBindStageInteractions = tsViewer.tsBindStageInteractions;
    tsViewer.tsBindStageInteractions = function (...tsArgs) {
        const tsResult = tsBindStageInteractions.apply(this, tsArgs);
        const tsShell = this.tsRefs.tsStage.querySelector(".ts-video-compare-shell");
        const tsGrid = tsShell?.querySelector(".ts-video-compare-grid");
        const tsControls = tsShell?.querySelector(".ts-video-compare-controls");
        if (!tsShell || !tsGrid || !tsControls || tsShell.dataset.forkLayout) {
            return tsResult;
        }
        // a split needs exactly two clips; three or four stay side by side
        const tsCanSplit = tsGrid.querySelectorAll(".ts-video-compare-card").length === 2;
        const tsButtons = [];
        const tsPaint = () => {
            tsShell.dataset.forkLayout = tsCanSplit ? tsLayout : "side";
            for (const tsButton of tsButtons) {
                const tsActive = tsButton.dataset.layout === tsShell.dataset.forkLayout;
                tsButton.dataset.active = String(tsActive);
                tsButton.setAttribute("aria-pressed", String(tsActive));
            }
        };
        if (tsCanSplit) {
            const tsDivider = document.createElement("div");
            tsDivider.className = "ts-fork-compare-divider";
            tsGrid.append(tsDivider);

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

            // drag anywhere over the clips: the divider follows the pointer
            let tsDragging = false;
            const tsMoveTo = (tsEvent) => {
                const tsRect = tsGrid.getBoundingClientRect();
                if (!tsRect.width) {
                    return;
                }
                const tsShare = Math.max(0, Math.min(1, (tsEvent.clientX - tsRect.left) / tsRect.width));
                tsGrid.style.setProperty("--ts-fork-wipe", `${(tsShare * 100).toFixed(2)}%`);
            };
            tsGrid.addEventListener("pointerdown", (tsEvent) => {
                if (tsShell.dataset.forkLayout !== "split" || tsEvent.button !== 0) {
                    return;
                }
                tsDragging = true;
                tsGrid.setPointerCapture?.(tsEvent.pointerId);
                tsEvent.preventDefault();
                tsMoveTo(tsEvent);
            });
            tsGrid.addEventListener("pointermove", (tsEvent) => {
                if (tsDragging) {
                    tsMoveTo(tsEvent);
                }
            });
            const tsStop = () => {
                tsDragging = false;
            };
            tsGrid.addEventListener("pointerup", tsStop);
            tsGrid.addEventListener("pointercancel", tsStop);
            tsGrid.addEventListener("lostpointercapture", tsStop);
        }
        tsPaint();
        return tsResult;
    };
}
