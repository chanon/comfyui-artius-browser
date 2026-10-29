// obvpm fork: click a filename in the viewer to copy it -- the title above an
// opened image / video, and a clip's name in a video comparison. In a
// comparison the name is also the handle that drags a clip to a new place,
// so only a press that ends where it started (no reorder) copies. The answer
// shows ON the clicked name ("Copied" for a moment): a page toast would be
// hidden behind the viewer, and outside a full-screen comparison. The name
// keeps its text (only made invisible) and "Copied" is laid over it, so the
// layout does not move.
import { tsCopyText } from "./ts-artius-browser-api.js";

const TS_FORK_COPY_SLOP = 4;
const TS_FORK_COPY_FLASH_MS = 1200;

const TS_FORK_COPY_NAME_CSS = `
    /* obvpm fork: click a filename to copy it */
    .ts-viewer .ts-title {
        cursor: pointer;
    }
    .ts-viewer .ts-title:hover {
        text-decoration: underline;
        text-underline-offset: 3px;
    }
    .ts-viewer .ts-video-compare-shell[data-fork-layout]:not([data-fork-reordering="true"]) .ts-video-compare-label {
        cursor: pointer;
    }
    /* the name's own text stays (same size), invisible, with the answer on top */
    /* hidden by its fill, not its colour: the accent can fall back to
       currentColor, which must still be the name's real colour */
    .ts-viewer .ts-title[data-fork-copied],
    .ts-viewer .ts-video-compare-label[data-fork-copied] {
        -webkit-text-fill-color: transparent;
        text-decoration: none;
        overflow: visible;
    }
    .ts-viewer .ts-title[data-fork-copied],
    .ts-viewer .ts-video-compare-shell:not([data-fork-layout="split"]) .ts-video-compare-label[data-fork-copied] {
        position: relative;
    }
    .ts-viewer .ts-title[data-fork-copied]::after,
    .ts-viewer .ts-video-compare-label[data-fork-copied]::after {
        content: attr(data-fork-copy-text);
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        white-space: nowrap;
        -webkit-text-fill-color: var(--ts-accent);
    }
    .ts-viewer .ts-title[data-fork-copied]::after {
        justify-content: flex-start;
    }
    .ts-viewer [data-fork-copied="failed"]::after {
        -webkit-text-fill-color: var(--ts-danger, #e5484d);
    }
`;

// the name says "Copied" for a moment: an overlay, the text underneath is
// untouched, so a render that writes a new name meanwhile is not disturbed
function tsForkFlash(tsViewer, tsElement, tsCopied) {
    if (!tsElement) {
        return;
    }
    clearTimeout(tsElement.tsForkCopyTimer);
    tsElement.dataset.forkCopyText = tsCopied
        ? tsViewer.tsT("toast.copied", "Copied")
        : tsViewer.tsT("toast.copyFailed", "Copy failed");
    tsElement.dataset.forkCopied = tsCopied ? "ok" : "failed";
    tsElement.tsForkCopyTimer = setTimeout(() => {
        delete tsElement.dataset.forkCopied;
        delete tsElement.dataset.forkCopyText;
    }, TS_FORK_COPY_FLASH_MS);
}

async function tsForkCopyName(tsViewer, tsName, tsElement) {
    if (!tsName) {
        return;
    }
    tsForkFlash(tsViewer, tsElement, await tsCopyText(tsName));
}

export function tsInstallForkCopyName(tsPanel) {
    const tsViewer = tsPanel?.tsViewer;
    const tsTitle = tsViewer?.tsRefs?.tsTitle;
    if (!tsTitle || tsViewer.tsForkCopyNameInstalled) {
        return;
    }
    tsViewer.tsForkCopyNameInstalled = true;
    const tsStyle = document.createElement("style");
    tsStyle.textContent = TS_FORK_COPY_NAME_CSS;
    tsViewer.shadowRoot.append(tsStyle);

    // the title: upstream fills it with the open asset's filename each render
    tsTitle.addEventListener("click", () => {
        const tsAsset = tsViewer.tsItems?.[tsViewer.tsIndex];
        void tsForkCopyName(tsViewer, tsAsset?.filename, tsTitle);
    });
    const tsRender = tsViewer.tsRender;
    tsViewer.tsRender = function (...tsArgs) {
        const tsResult = tsRender.apply(this, tsArgs);
        tsTitle.title = this.tsT("fork.viewer.copyName", "Click to copy the filename");
        return tsResult;
    };

    // the comparison's clip names: the reorder drag captures the pointer on
    // the grid, so the label never gets a click -- watch the press instead
    const tsBindStageInteractions = tsViewer.tsBindStageInteractions;
    tsViewer.tsBindStageInteractions = function (...tsArgs) {
        const tsResult = tsBindStageInteractions.apply(this, tsArgs);
        const tsGrid = this.tsRefs.tsStage.querySelector(".ts-video-compare-grid");
        if (!tsGrid) {
            return tsResult;
        }
        const tsCards = Array.from(tsGrid.querySelectorAll(".ts-video-compare-card"));
        const tsItems = (Array.isArray(this.tsCompareItems) ? this.tsCompareItems : []).slice(0, tsCards.length);
        let tsPress = null;
        tsCards.forEach((tsCard, tsIndex) => {
            const tsLabel = tsCard.querySelector(".ts-video-compare-label");
            const tsItem = tsItems[tsIndex];
            if (!tsLabel || !tsItem) {
                return;
            }
            tsLabel.title = `${tsLabel.title}\n${this.tsT("fork.viewer.copyName", "Click to copy the filename")}`;
            tsLabel.addEventListener("pointerdown", (tsEvent) => {
                if (tsEvent.button !== 0) {
                    return;
                }
                tsPress = {
                    tsItem,
                    tsLabel,
                    tsCard,
                    tsPointerId: tsEvent.pointerId,
                    tsX: tsEvent.clientX,
                    tsY: tsEvent.clientY,
                    tsOrder: Array.from(tsGrid.children).indexOf(tsCard),
                };
            });
        });
        tsGrid.addEventListener("pointerup", (tsEvent) => {
            const tsHeld = tsPress;
            tsPress = null;
            if (!tsHeld || tsEvent.pointerId !== tsHeld.tsPointerId) {
                return;
            }
            const tsStill = Math.hypot(tsEvent.clientX - tsHeld.tsX, tsEvent.clientY - tsHeld.tsY) <= TS_FORK_COPY_SLOP;
            const tsSamePlace = Array.from(tsGrid.children).indexOf(tsHeld.tsCard) === tsHeld.tsOrder;
            if (tsStill && tsSamePlace) {
                void tsForkCopyName(this, tsHeld.tsItem.filename, tsHeld.tsLabel);
            }
        });
        tsGrid.addEventListener("pointercancel", () => {
            tsPress = null;
        });
        return tsResult;
    };
}
