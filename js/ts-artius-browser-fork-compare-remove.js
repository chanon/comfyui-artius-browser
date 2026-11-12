// obvpm fork: an "x" after each clip's name in a video comparison takes that
// clip out of the comparison (its selection in the panel stays as it is). The
// others carry on from the same moment (playing if they were playing, in full
// screen if it was); with one clip left the viewer shows it on its own, paused
// or playing.
//
// Upstream already drops a clip from a running comparison in one place -- a
// delete while comparing filters tsCompareItems and re-renders -- so this does
// the same: in a comparison the viewer's list IS the compared clips (tsItems)
// and tsIndex is the one with the sound. tsRender rebuilds the stage because
// its markup lists the clips. A fresh comparison stage starts paused at 0:00,
// so the time and play state are put back on the new stage afterwards through
// upstream's own seek bar and Play button; the single player takes the time
// from upstream's tsVideoCarry.
//
// Installed after compare-names, video-compare and copy-name: their wraps have
// already written the label (names with folders, tooltips) and hooked its
// pointerdown (reorder drag, copy). The x stops its own pointerdown, so a press
// on it starts neither of those, nor a Split divider drag.

const TS_FORK_REMOVE_CSS = `
    /* obvpm fork: x after each clip's name in a video comparison */
    .ts-viewer .ts-video-compare-label[data-fork-removable] {
        display: flex;
        align-items: center;
        gap: 4px;
        padding-right: 4px;
        text-overflow: clip;
    }
    .ts-viewer .ts-fork-compare-name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .ts-viewer .ts-fork-compare-remove {
        flex: none;
        display: inline-grid;
        place-items: center;
        width: 14px;
        height: 14px;
        /* the viewer's button rules give every button a minimum size, which
           made the name label as tall as a toolbar button */
        min-width: 0;
        min-height: 0;
        margin: 0;
        padding: 0;
        border: 0;
        border-radius: 4px;
        background: transparent;
        color: inherit;
        opacity: 0.6;
        cursor: pointer;
    }
    .ts-viewer .ts-fork-compare-remove:hover,
    .ts-viewer .ts-fork-compare-remove:focus-visible {
        opacity: 1;
        background: var(--ts-surface-ghost);
    }
    .ts-viewer .ts-fork-compare-remove svg {
        width: 8px;
        height: 8px;
    }
`;

const TS_FORK_REMOVE_ICON = `<svg viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M1.5 1.5 8.5 8.5M8.5 1.5 1.5 8.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>`;

// once the new stage's primary clip knows its length (the seek bar's max is
// its duration; a value set before that is clamped to 0)
function tsWhenPrimaryReady(tsVideo, tsDo) {
    if (!tsVideo) {
        return;
    }
    if (tsVideo.readyState >= 1) {
        tsDo();
        return;
    }
    tsVideo.addEventListener("loadedmetadata", () => tsDo(), { once: true });
}

export function tsInstallForkCompareRemove(tsPanel) {
    const tsViewer = tsPanel?.tsViewer;
    if (!tsViewer?.tsRefs?.tsStage || tsViewer.tsForkCompareRemoveInstalled) {
        return;
    }
    tsViewer.tsForkCompareRemoveInstalled = true;
    const tsStyle = document.createElement("style");
    tsStyle.textContent = TS_FORK_REMOVE_CSS;
    tsViewer.shadowRoot.append(tsStyle);

    const tsRemove = (tsId) => {
        const tsViewerNow = tsViewer;
        const tsItems = Array.isArray(tsViewerNow.tsCompareItems) ? tsViewerNow.tsCompareItems : [];
        if (!tsItems.some((tsItem) => tsItem.id === tsId)) {
            return;
        }
        const tsStage = tsViewerNow.tsRefs.tsStage;
        const tsOldPrimary = tsStage.querySelector('.ts-compare-video[data-primary="true"]')
            || tsStage.querySelector(".ts-compare-video");
        const tsTime = Number(tsOldPrimary?.currentTime || 0);
        const tsPlaying = tsStage.querySelector(".ts-video-compare-shell .ts-video-play-toggle")
            ?.dataset.tsI18n === "button.pause";
        const tsWasFullScreen = Boolean(tsViewerNow.shadowRoot.fullscreenElement);

        // the clip with the sound stays so; if it is the one going, the
        // left-most of the rest takes over (tsCompareItems is in card order)
        const tsRemaining = tsItems.filter((tsItem) => tsItem.id !== tsId);
        const tsOldPrimaryId = tsViewerNow.tsItems?.[tsViewerNow.tsIndex]?.id;
        const tsPrimaryId = tsRemaining.some((tsItem) => tsItem.id === tsOldPrimaryId)
            ? tsOldPrimaryId
            : tsRemaining[0]?.id;

        tsViewerNow.tsItems = (tsViewerNow.tsItems || []).filter((tsItem) => tsItem.id !== tsId);
        if (!tsViewerNow.tsItems.length || tsPrimaryId === undefined) {
            tsViewerNow.tsClose();
            return;
        }
        const tsStillCompare = tsRemaining.length >= 2;
        tsViewerNow.tsCompareItems = tsStillCompare ? tsRemaining : [];
        tsViewerNow.tsIndex = Math.max(0, tsViewerNow.tsItems.findIndex((tsItem) => tsItem.id === tsPrimaryId));
        if (!tsStillCompare) {
            // upstream's hand-over to a single clip: it opens paused here
            tsViewerNow.tsVideoCarry = { tsTime, tsAtEnd: false };
        }
        tsViewerNow.tsRender();
        tsViewerNow.tsRefs.tsRoot?.focus?.({ preventScroll: true });

        const tsShell = tsStage.querySelector(tsStillCompare ? ".ts-video-compare-shell" : ".ts-video-shell");
        if (tsWasFullScreen && tsShell?.requestFullscreen) {
            // still inside the click, so the browser allows it
            void tsShell.requestFullscreen().catch(() => {});
        }
        const tsNewPrimary = tsStillCompare
            ? (tsStage.querySelector('.ts-compare-video[data-primary="true"]') || tsStage.querySelector(".ts-compare-video"))
            : tsStage.querySelector("video");
        tsWhenPrimaryReady(tsNewPrimary, () => {
            if (!tsNewPrimary.isConnected) {
                return;
            }
            if (tsStillCompare) {
                const tsSeek = tsStage.querySelector(".ts-video-compare-shell .ts-video-seek");
                if (tsSeek && tsTime > 0) {
                    tsSeek.value = String(tsTime);
                    tsSeek.dispatchEvent(new Event("input", { bubbles: true }));
                    tsSeek.dispatchEvent(new Event("change", { bubbles: true }));
                }
            }
            if (tsPlaying) {
                tsStage.querySelector(".ts-video-play-toggle")?.click();
            }
        });
    };

    const tsBindStageInteractions = tsViewer.tsBindStageInteractions;
    tsViewer.tsBindStageInteractions = function (...tsArgs) {
        const tsResult = tsBindStageInteractions.apply(this, tsArgs);
        const tsGrid = this.tsRefs.tsStage.querySelector(".ts-video-compare-grid");
        if (!tsGrid) {
            return tsResult;
        }
        const tsCards = Array.from(tsGrid.querySelectorAll(":scope > .ts-video-compare-card"));
        const tsItems = (Array.isArray(this.tsCompareItems) ? this.tsCompareItems : []).slice(0, tsCards.length);
        const tsHint = this.tsT("fork.video.compare.remove", "Remove from the comparison");
        tsCards.forEach((tsCard, tsIndex) => {
            const tsLabel = tsCard.querySelector(".ts-video-compare-label");
            const tsItem = tsItems.find((tsCandidate) => String(tsCandidate.id) === tsCard.dataset.forkItemId)
                || tsItems[tsIndex];
            if (!tsLabel || !tsItem || tsLabel.dataset.forkRemovable) {
                return;
            }
            // the name in its own box, so it is the part cut with "..." and
            // the x always shows
            const tsName = document.createElement("span");
            tsName.className = "ts-fork-compare-name";
            tsName.append(...tsLabel.childNodes);
            const tsButton = document.createElement("button");
            tsButton.type = "button";
            tsButton.className = "ts-fork-compare-remove";
            tsButton.title = tsHint;
            tsButton.setAttribute("aria-label", tsHint);
            tsButton.innerHTML = TS_FORK_REMOVE_ICON;
            // a press here is not a reorder drag, a copy or a divider drag
            tsButton.addEventListener("pointerdown", (tsEvent) => tsEvent.stopPropagation());
            tsButton.addEventListener("click", (tsEvent) => {
                tsEvent.stopPropagation();
                tsRemove(tsItem.id);
            });
            tsLabel.dataset.forkRemovable = "true";
            tsLabel.append(tsName, tsButton);
        });
        return tsResult;
    };
}
