// obvpm fork: a Full Screen button for the video comparison, next to Fit / 1:1,
// and for the single video when it has the video bar feature's play bar (the
// browser's own controls, which had one, are gone there). The whole player
// goes full screen -- the clips AND its controls row -- so play, seek, frame
// steps, zoom, Loop and Split keep working there. Esc (or the button again)
// comes back to the viewer; that Esc must not also close the viewer, which is
// what Esc does otherwise.
const TS_FORK_FULLSCREEN_CSS = `
    /* obvpm fork: video full screen */
    .ts-viewer .ts-video-compare-shell:fullscreen,
    .ts-viewer .ts-video-shell:fullscreen {
        box-sizing: border-box;
        width: 100%;
        height: 100%;
        max-width: none;
        max-height: none;
        padding: 12px;
        background: #000;
    }
    .ts-video-compare-shell::backdrop,
    .ts-video-shell::backdrop {
        background: #000;
    }
    /* the single video fills the screen above its bar, whatever its size mode */
    .ts-viewer .ts-video-shell:fullscreen {
        grid-template-rows: minmax(0, 1fr) auto;
        align-items: stretch;
    }
    .ts-viewer .ts-video-shell:fullscreen .ts-fork-video-box {
        display: flex;
        position: relative;
        contain: size;
        min-width: 0;
        min-height: 0;
    }
    .ts-viewer .ts-video-shell:fullscreen video {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        max-height: none;
        object-fit: contain;
    }
    .ts-fork-fullscreen {
        flex: none;
        white-space: nowrap;
    }
    .ts-fork-fullscreen[data-active="true"] {
        border-color: var(--ts-accent);
        background: color-mix(in srgb, var(--ts-accent) 18%, var(--ts-bg-2));
    }
`;

// how long after leaving full screen an Esc still belongs to it: the browser
// may leave full screen first and deliver the key after
const TS_FORK_FULLSCREEN_ESC_MS = 400;

export function tsInstallForkVideoFullscreen(tsPanel) {
    const tsViewer = tsPanel?.tsViewer;
    if (!tsViewer?.tsRefs?.tsStage || tsViewer.tsForkVideoFullscreenInstalled) {
        return;
    }
    tsViewer.tsForkVideoFullscreenInstalled = true;
    if (typeof Element === "undefined" || typeof Element.prototype.requestFullscreen !== "function") {
        return;
    }
    const tsStyle = document.createElement("style");
    tsStyle.textContent = TS_FORK_FULLSCREEN_CSS;
    tsViewer.shadowRoot.append(tsStyle);

    // the element in full screen, as seen inside the viewer's shadow root
    const tsFullscreenShell = () => {
        const tsElement = tsViewer.shadowRoot.fullscreenElement;
        return tsElement?.classList?.contains("ts-video-compare-shell") || tsElement?.classList?.contains("ts-video-shell")
            ? tsElement : null;
    };
    let tsLeftAt = 0;
    document.addEventListener("fullscreenchange", () => {
        if (!tsFullscreenShell()) {
            tsLeftAt = Date.now();
        }
    });

    const tsHandleKeydown = tsViewer.tsHandleKeydown;
    tsViewer.tsHandleKeydown = function (tsEvent) {
        if (tsEvent.key === "Escape" && (tsFullscreenShell() || Date.now() - tsLeftAt < TS_FORK_FULLSCREEN_ESC_MS)) {
            tsEvent.preventDefault();
            if (tsFullscreenShell()) {
                void document.exitFullscreen?.().catch(() => {});
            }
            return;
        }
        return tsHandleKeydown.call(this, tsEvent);
    };

    const tsBindStageInteractions = tsViewer.tsBindStageInteractions;
    tsViewer.tsBindStageInteractions = function (...tsArgs) {
        const tsResult = tsBindStageInteractions.apply(this, tsArgs);
        const tsCompareShell = this.tsRefs.tsStage.querySelector(".ts-video-compare-shell");
        // the single video only with the play bar (else its own controls have full screen)
        const tsSingleShell = tsCompareShell ? null
            : this.tsRefs.tsStage.querySelector(".ts-video-shell:has(.ts-video-controls > .ts-video-transport)");
        const tsShell = tsCompareShell || tsSingleShell;
        const tsControls = tsCompareShell ? tsCompareShell.querySelector(".ts-video-compare-controls")
            : tsSingleShell?.querySelector(".ts-video-controls");
        if (!tsControls || tsControls.querySelector(".ts-fork-fullscreen")) {
            return tsResult;
        }
        const tsButton = document.createElement("button");
        tsButton.type = "button";
        tsButton.className = "ts-video-step ts-fork-fullscreen";
        const tsPaint = () => {
            const tsOn = tsFullscreenShell() === tsShell;
            tsButton.textContent = tsOn
                ? this.tsT("fork.video.fullscreen.exit", "Exit Full Screen")
                : this.tsT("fork.video.fullscreen", "Full Screen");
            tsButton.title = tsOn
                ? this.tsT("fork.video.fullscreen.exit.hint", "Back to the viewer (Esc)")
                : tsSingleShell
                    ? this.tsT("fork.video.fullscreen.single.hint", "Show the video on the whole screen (Esc to come back)")
                    : this.tsT("fork.video.fullscreen.hint", "Show the comparison on the whole screen (Esc to come back)");
            tsButton.dataset.active = String(tsOn);
            tsButton.setAttribute("aria-pressed", String(tsOn));
        };
        tsButton.addEventListener("click", () => {
            if (tsFullscreenShell() === tsShell) {
                void document.exitFullscreen?.().catch(() => {});
            } else {
                void tsShell.requestFullscreen?.().catch(() => {});
            }
        });
        const tsOnChange = () => {
            if (!tsShell.isConnected) {
                document.removeEventListener("fullscreenchange", tsOnChange);
                return;
            }
            tsPaint();
        };
        document.addEventListener("fullscreenchange", tsOnChange);
        tsPaint();
        // right after Fit / 1:1 and the zoom readout (no zoom in this
        // browser: before the layout switch / close button)
        const tsZoom = tsControls.querySelector(".ts-fork-zoom-readout")
            || tsControls.querySelector(".ts-fork-zoom-buttons")
            || tsControls.querySelector(".ts-fork-video-size");
        const tsBefore = tsZoom ? tsZoom.nextSibling
            : (tsControls.querySelector(".ts-fork-compare-layout") || tsControls.querySelector(".ts-compare-close"));
        tsControls.insertBefore(tsButton, tsBefore);

        // the stage going away (close, another asset) leaves full screen too
        const tsUpstreamCleanup = this.tsStageCleanup;
        this.tsStageCleanup = () => {
            document.removeEventListener("fullscreenchange", tsOnChange);
            if (tsFullscreenShell() === tsShell) {
                void document.exitFullscreen?.().catch(() => {});
            }
            if (typeof tsUpstreamCleanup === "function") {
                tsUpstreamCleanup();
            }
        };
        return tsResult;
    };
}
