// obvpm fork: zoom for videos in the viewer -- the single video and the video
// comparison alike. Wheel up zooms in at the cursor, wheel down zooms back
// out and stops at Fit; the middle mouse button drags a zoomed picture
// around. Fit / 1:1 buttons and a readout of the zoom: the single video uses
// the Fit / 1:1 / Centered buttons of the video size feature, the comparison
// gets its own pair. Upstream's zoom keys (+ / - / 0 / 1) work as well: they
// drive whatever handler sits in tsImageZoomHandler.
// The zoom crops the PICTURE (CSS object-view-box), it does not scale the
// <video> element: the element keeps its size, so the single video's own
// play / seek / volume bar stays in place and readable at any zoom, and the
// split comparison's strips (clipped on the cards) do not move. A view box
// larger than the picture shows it smaller than its box, which is how 1:1
// shows a clip smaller than the stage.
import { tsViewerSettings } from "./ts-artius-browser-settings.js";

const TS_FORK_ZOOM_SUPPORTED = typeof CSS !== "undefined"
    && typeof CSS.supports === "function"
    && CSS.supports("object-view-box", "inset(0px 0px 0px 0px)");

const TS_FORK_ZOOM_CSS = `
    /* obvpm fork: video zoom */
    .ts-fork-zoom-panning,
    .ts-fork-zoom-panning video {
        cursor: grabbing;
    }
    .ts-fork-zoom-readout {
        flex: none;
        min-width: 44px;
        text-align: center;
        color: var(--ts-text-muted);
        font: 600 11px/1.3 inherit;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }
    .ts-fork-zoom-buttons {
        flex: none;
        display: inline-flex;
    }
    .ts-fork-zoom-buttons button {
        border-radius: 0;
        margin-left: -1px;
        white-space: nowrap;
    }
    .ts-fork-zoom-buttons button:first-child {
        border-radius: 8px 0 0 8px;
        margin-left: 0;
    }
    .ts-fork-zoom-buttons button:last-child {
        border-radius: 0 8px 8px 0;
    }
    .ts-fork-zoom-buttons button[data-active="true"] {
        position: relative;
        border-color: var(--ts-accent);
        background: color-mix(in srgb, var(--ts-accent) 18%, var(--ts-bg-2));
    }
`;

const TS_FORK_ZOOM_EVENT = "ts-fork-video-zoom";

function tsClamp(tsValue, tsLow, tsHigh) {
    return Math.max(tsLow, Math.min(tsHigh, tsValue));
}

function tsPx(tsValue) {
    return `${Number(tsValue.toFixed(3))}px`;
}

// One zoom for a set of clips: one scale (relative to each clip's own Fit)
// and one centre point (as a share of the picture), so clips compared side
// by side or split always show the same part at the same size.
// tsVideos[0] is the clip "1:1" and the readout are measured on.
function tsCreateVideoZoom({ tsVideos, tsSurface, tsLockSize, tsOnChange }) {
    const tsLimits = tsViewerSettings.imageZoom;
    const tsMain = tsVideos[0];
    let tsScale = 1;
    let tsCenterX = 0.5;
    let tsCenterY = 0.5;
    // 1:1 holds through a box size change (window, info panel, layout) and
    // lands on whole video pixels
    let tsAtNative = false;
    let tsNativePending = false;
    const tsLocked = new Set();

    // How a clip is drawn at the current zoom: the part of the picture in its
    // box (the view box, in video pixels), screen pixels per video pixel.
    const tsGeometry = (tsVideo) => {
        const tsW = tsVideo.videoWidth;
        const tsH = tsVideo.videoHeight;
        const tsBoxW = tsVideo.clientWidth;
        const tsBoxH = tsVideo.clientHeight;
        if (!tsW || !tsH || !tsBoxW || !tsBoxH) {
            return null;
        }
        const tsFit = Math.min(tsBoxW / tsW, tsBoxH / tsH);
        const tsPerPixel = tsFit * tsScale;
        const tsViewW = tsBoxW / tsPerPixel;
        const tsViewH = tsBoxH / tsPerPixel;
        // a picture narrower than the view stays centred; a wider one cannot
        // be dragged past its edges
        let tsLeft = tsViewW >= tsW ? (tsW - tsViewW) / 2 : tsClamp((tsCenterX * tsW) - (tsViewW / 2), 0, tsW - tsViewW);
        let tsTop = tsViewH >= tsH ? (tsH - tsViewH) / 2 : tsClamp((tsCenterY * tsH) - (tsViewH / 2), 0, tsH - tsViewH);
        if (tsAtNative) {
            tsLeft = Math.round(tsLeft);
            tsTop = Math.round(tsTop);
        }
        return { tsW, tsH, tsBoxW, tsBoxH, tsFit, tsPerPixel, tsViewW, tsViewH, tsLeft, tsTop };
    };

    const tsNativeScale = () => {
        const tsGeo = tsGeometry(tsMain);
        return tsGeo ? 1 / tsGeo.tsFit : 0;
    };

    // the picture point (as a share of the picture) under a screen point
    const tsPictureAt = (tsVideo, tsClientX, tsClientY) => {
        const tsGeo = tsGeometry(tsVideo);
        if (!tsGeo) {
            return null;
        }
        const tsRect = tsVideo.getBoundingClientRect();
        return {
            tsX: (tsGeo.tsLeft + ((tsClientX - tsRect.left - tsVideo.clientLeft) / tsGeo.tsPerPixel)) / tsGeo.tsW,
            tsY: (tsGeo.tsTop + ((tsClientY - tsRect.top - tsVideo.clientTop) / tsGeo.tsPerPixel)) / tsGeo.tsH,
        };
    };

    // store the centre the main clip can actually show, so a drag past an
    // edge does not have to be "undone" before the picture moves back
    const tsSettleCenter = () => {
        const tsGeo = tsGeometry(tsMain);
        if (!tsGeo) {
            return;
        }
        tsCenterX = tsGeo.tsViewW >= tsGeo.tsW ? 0.5 : (tsGeo.tsLeft + (tsGeo.tsViewW / 2)) / tsGeo.tsW;
        tsCenterY = tsGeo.tsViewH >= tsGeo.tsH ? 0.5 : (tsGeo.tsTop + (tsGeo.tsViewH / 2)) / tsGeo.tsH;
    };

    const tsState = () => {
        const tsGeo = tsGeometry(tsMain);
        return {
            tsScale,
            tsPercent: tsGeo ? Math.round(tsGeo.tsPerPixel * 100) : null,
            tsAtFit: Math.abs(tsScale - 1) < 0.001,
            tsAtNative: tsAtNative || (tsGeo ? Math.abs(tsGeo.tsPerPixel - 1) < 0.002 : false),
        };
    };

    const tsApply = () => {
        const tsZoomed = Math.abs(tsScale - 1) >= 0.001;
        for (const tsVideo of tsVideos) {
            if (!tsZoomed) {
                tsVideo.style.objectViewBox = "";
                if (tsLocked.has(tsVideo)) {
                    tsVideo.style.width = "";
                    tsVideo.style.height = "";
                    tsLocked.delete(tsVideo);
                }
                continue;
            }
            // Where the element's height follows the picture's shape (the
            // Centered layout), a view box would change that shape: hold the
            // element at its Fit size while zoomed.
            if (tsLockSize() && !tsLocked.has(tsVideo) && tsVideo.clientWidth && tsVideo.clientHeight) {
                tsVideo.style.width = `${tsVideo.clientWidth}px`;
                tsVideo.style.height = `${tsVideo.clientHeight}px`;
                tsLocked.add(tsVideo);
            }
            const tsGeo = tsGeometry(tsVideo);
            if (!tsGeo) {
                tsVideo.style.objectViewBox = "";
                continue;
            }
            const tsRight = tsGeo.tsW - tsGeo.tsLeft - tsGeo.tsViewW;
            const tsBottom = tsGeo.tsH - tsGeo.tsTop - tsGeo.tsViewH;
            tsVideo.style.objectViewBox = `inset(${tsPx(tsGeo.tsTop)} ${tsPx(tsRight)} ${tsPx(tsBottom)} ${tsPx(tsGeo.tsLeft)})`;
        }
        tsOnChange(tsState());
    };

    // zoom keeping the picture point under (tsClientX, tsClientY) in place
    const tsZoomAround = (tsNext, tsClientX, tsClientY, tsVideo) => {
        const tsPoint = tsPictureAt(tsVideo, tsClientX, tsClientY);
        tsScale = tsNext;
        const tsGeo = tsGeometry(tsVideo);
        if (tsPoint && tsGeo) {
            const tsRect = tsVideo.getBoundingClientRect();
            const tsLeft = (tsPoint.tsX * tsGeo.tsW) - ((tsClientX - tsRect.left - tsVideo.clientLeft) / tsGeo.tsPerPixel);
            const tsTop = (tsPoint.tsY * tsGeo.tsH) - ((tsClientY - tsRect.top - tsVideo.clientTop) / tsGeo.tsPerPixel);
            tsCenterX = (tsLeft + (tsGeo.tsViewW / 2)) / tsGeo.tsW;
            tsCenterY = (tsTop + (tsGeo.tsViewH / 2)) / tsGeo.tsH;
        }
        tsSettleCenter();
        tsApply();
    };

    const tsMiddleOf = (tsVideo) => {
        const tsRect = tsVideo.getBoundingClientRect();
        return [tsRect.left + (tsRect.width / 2), tsRect.top + (tsRect.height / 2)];
    };

    const tsZoomTo = (tsNext, tsClientX = null, tsClientY = null, tsVideo = tsMain) => {
        const tsMax = Math.max(tsLimits.max, tsNativeScale());
        // zooming out stops at Fit -- or where 1:1 put a clip smaller than
        // its box, which is below Fit already
        const tsTarget = tsClamp(tsNext, Math.min(1, tsScale), tsMax);
        if (Math.abs(tsTarget - tsScale) < 0.0001) {
            return;
        }
        tsAtNative = false;
        tsNativePending = false;
        if (tsClientX === null || tsClientY === null) {
            [tsClientX, tsClientY] = tsMiddleOf(tsVideo);
        }
        tsZoomAround(tsTarget, tsClientX, tsClientY, tsVideo);
    };

    const tsFit = () => {
        tsScale = 1;
        tsCenterX = 0.5;
        tsCenterY = 0.5;
        tsAtNative = false;
        tsNativePending = false;
        tsApply();
    };

    const tsNative = () => {
        const tsTarget = tsNativeScale();
        if (!tsTarget) {
            // not loaded yet: done once the clip knows its size
            tsNativePending = true;
            return;
        }
        tsNativePending = false;
        tsAtNative = true;
        const [tsClientX, tsClientY] = tsMiddleOf(tsMain);
        tsZoomAround(tsTarget, tsClientX, tsClientY, tsMain);
    };

    const tsPanBy = (tsDeltaX, tsDeltaY) => {
        const tsGeo = tsGeometry(tsMain);
        if (!tsGeo || tsScale <= 1.001) {
            return false;
        }
        tsCenterX -= tsDeltaX / (tsGeo.tsPerPixel * tsGeo.tsW);
        tsCenterY -= tsDeltaY / (tsGeo.tsPerPixel * tsGeo.tsH);
        tsSettleCenter();
        tsApply();
        return true;
    };

    // the clip under the cursor anchors a wheel zoom
    const tsVideoAt = (tsEvent) => {
        const tsCardVideo = tsEvent.target?.closest?.(".ts-video-compare-card")?.querySelector("video");
        if (tsCardVideo && tsVideos.includes(tsCardVideo)) {
            return tsCardVideo;
        }
        return tsVideos.find((tsVideo) => {
            const tsRect = tsVideo.getBoundingClientRect();
            return tsEvent.clientX >= tsRect.left && tsEvent.clientX <= tsRect.right
                && tsEvent.clientY >= tsRect.top && tsEvent.clientY <= tsRect.bottom;
        }) || tsMain;
    };

    const tsHandleWheel = (tsEvent) => {
        // Ctrl+wheel is the browser's page zoom
        if (tsEvent.ctrlKey || tsEvent.metaKey || !tsEvent.deltaY) {
            return;
        }
        tsEvent.preventDefault();
        tsZoomTo(
            tsScale * (tsEvent.deltaY < 0 ? tsLimits.stepIn : tsLimits.stepOut),
            tsEvent.clientX,
            tsEvent.clientY,
            tsVideoAt(tsEvent),
        );
    };

    let tsPan = null;
    const tsHandlePointerDown = (tsEvent) => {
        if (tsEvent.button !== 1 || tsScale <= 1.001) {
            return;
        }
        tsEvent.preventDefault();
        tsPan = { tsId: tsEvent.pointerId, tsX: tsEvent.clientX, tsY: tsEvent.clientY };
        tsSurface.setPointerCapture?.(tsEvent.pointerId);
        tsSurface.classList.add("ts-fork-zoom-panning");
    };
    const tsHandlePointerMove = (tsEvent) => {
        if (!tsPan || tsEvent.pointerId !== tsPan.tsId) {
            return;
        }
        tsEvent.preventDefault();
        tsPanBy(tsEvent.clientX - tsPan.tsX, tsEvent.clientY - tsPan.tsY);
        tsPan.tsX = tsEvent.clientX;
        tsPan.tsY = tsEvent.clientY;
    };
    const tsStopPan = (tsEvent) => {
        if (!tsPan || (tsEvent && tsEvent.pointerId !== tsPan.tsId)) {
            return;
        }
        try {
            tsSurface.releasePointerCapture?.(tsPan.tsId);
        } catch {
            // already released
        }
        tsPan = null;
        tsSurface.classList.remove("ts-fork-zoom-panning");
    };
    // no autoscroll / paste on the middle button over the clips
    const tsHandleMiddle = (tsEvent) => {
        if (tsEvent.button === 1) {
            tsEvent.preventDefault();
        }
    };

    const tsHandleMetadata = () => {
        if (tsNativePending) {
            tsNative();
        } else {
            tsSettleCenter();
            tsApply();
        }
    };
    // a new box size changes Fit: keep 1:1 at 1:1, everything else at its
    // scale relative to Fit
    const tsObserver = typeof ResizeObserver === "function"
        ? new ResizeObserver(() => {
            if (tsAtNative && tsNativeScale()) {
                tsScale = tsNativeScale();
            }
            tsSettleCenter();
            tsApply();
        })
        : null;
    // a held (Centered) size cannot follow the window: back to Fit
    const tsHandleWindowResize = () => {
        if (tsLocked.size) {
            tsFit();
        }
    };

    tsSurface.addEventListener("wheel", tsHandleWheel, { passive: false });
    tsSurface.addEventListener("pointerdown", tsHandlePointerDown);
    tsSurface.addEventListener("pointermove", tsHandlePointerMove);
    tsSurface.addEventListener("pointerup", tsStopPan);
    tsSurface.addEventListener("pointercancel", tsStopPan);
    tsSurface.addEventListener("lostpointercapture", tsStopPan);
    tsSurface.addEventListener("mousedown", tsHandleMiddle);
    tsSurface.addEventListener("auxclick", tsHandleMiddle);
    window.addEventListener("resize", tsHandleWindowResize);
    for (const tsVideo of tsVideos) {
        tsVideo.addEventListener("loadedmetadata", tsHandleMetadata);
        tsVideo.addEventListener("resize", tsHandleMetadata);
        tsObserver?.observe(tsVideo);
    }
    // paint the buttons and the readout for Fit
    tsApply();

    return {
        tsFit,
        tsNative,
        tsState,
        // what upstream's zoom keys call (+ / - / 0 / 1)
        tsHandler: {
            tsZoomBy: (tsFactor) => tsZoomTo(tsScale * tsFactor),
            tsZoomToNative: () => {
                if (tsState().tsAtNative) {
                    tsFit();
                } else {
                    tsNative();
                }
            },
            tsReset: tsFit,
            tsIsZoomed: () => tsScale > 1.001,
            tsPanBy,
        },
        tsDestroy: () => {
            tsStopPan();
            tsObserver?.disconnect();
            tsSurface.removeEventListener("wheel", tsHandleWheel);
            tsSurface.removeEventListener("pointerdown", tsHandlePointerDown);
            tsSurface.removeEventListener("pointermove", tsHandlePointerMove);
            tsSurface.removeEventListener("pointerup", tsStopPan);
            tsSurface.removeEventListener("pointercancel", tsStopPan);
            tsSurface.removeEventListener("lostpointercapture", tsStopPan);
            tsSurface.removeEventListener("mousedown", tsHandleMiddle);
            tsSurface.removeEventListener("auxclick", tsHandleMiddle);
            window.removeEventListener("resize", tsHandleWindowResize);
            for (const tsVideo of tsVideos) {
                tsVideo.removeEventListener("loadedmetadata", tsHandleMetadata);
                tsVideo.removeEventListener("resize", tsHandleMetadata);
                tsVideo.style.objectViewBox = "";
            }
        },
    };
}

function tsReadout(tsState) {
    return tsState.tsPercent === null ? "" : `${tsState.tsPercent}%`;
}

export function tsInstallForkVideoZoom(tsPanel) {
    const tsViewer = tsPanel?.tsViewer;
    if (!tsViewer?.tsRefs?.tsStage || tsViewer.tsForkVideoZoomInstalled) {
        return;
    }
    tsViewer.tsForkVideoZoomInstalled = true;
    // the video size feature hides its 1:1 button where this cannot work
    tsViewer.tsForkVideoZoomSupported = TS_FORK_ZOOM_SUPPORTED;
    if (!TS_FORK_ZOOM_SUPPORTED) {
        return;
    }
    const tsStyle = document.createElement("style");
    tsStyle.textContent = TS_FORK_ZOOM_CSS;
    tsViewer.shadowRoot.append(tsStyle);

    const tsBindStageInteractions = tsViewer.tsBindStageInteractions;
    tsViewer.tsBindStageInteractions = function (...tsArgs) {
        const tsResult = tsBindStageInteractions.apply(this, tsArgs);
        const tsStage = this.tsRefs.tsStage;
        const tsSingleShell = tsStage.querySelector(".ts-video-shell");
        const tsCompareShell = tsStage.querySelector(".ts-video-compare-shell");
        let tsZoom = null;

        if (tsSingleShell) {
            const tsVideo = tsSingleShell.querySelector("video");
            const tsControls = tsSingleShell.querySelector(".ts-video-controls");
            if (!tsVideo) {
                return tsResult;
            }
            const tsLabel = document.createElement("div");
            tsLabel.className = "ts-fork-zoom-readout";
            tsLabel.title = this.tsT("fork.video.zoom.hint", "Zoom: mouse wheel over the video, drag with the middle button to move around");
            tsControls?.append(tsLabel);
            tsZoom = tsCreateVideoZoom({
                tsVideos: [tsVideo],
                tsSurface: tsVideo,
                tsLockSize: () => tsSingleShell.dataset.forkSize === "centered",
                tsOnChange: (tsState) => {
                    tsLabel.textContent = tsReadout(tsState);
                    // the video size feature lights its Fit / 1:1 buttons from this
                    tsSingleShell.dispatchEvent(new CustomEvent(TS_FORK_ZOOM_EVENT, { detail: tsState }));
                },
            });
            // the video size feature asks for 1:1 when that is the remembered size
            if (tsSingleShell.dataset.forkZoomStart === "native") {
                tsZoom.tsNative();
            }
        } else if (tsCompareShell) {
            const tsGrid = tsCompareShell.querySelector(".ts-video-compare-grid");
            const tsControls = tsCompareShell.querySelector(".ts-video-compare-controls");
            const tsVideos = Array.from(tsGrid?.querySelectorAll("video") || []);
            if (!tsGrid || !tsControls || !tsVideos.length) {
                return tsResult;
            }
            // the clip the comparison was opened from is the one 1:1 is exact for
            const tsPrimaryIndex = Math.max(0, tsVideos.findIndex((tsVideo) => tsVideo.dataset.primary === "true"));
            tsVideos.unshift(...tsVideos.splice(tsPrimaryIndex, 1));

            const tsGroup = document.createElement("div");
            tsGroup.className = "ts-fork-zoom-buttons";
            tsGroup.setAttribute("role", "group");
            const tsButtons = {};
            for (const [tsValue, tsKey, tsText, tsHintKey, tsHint] of [
                ["fit", "fork.video.size.fit", "Fit", "fork.video.zoom.fit.hint", "Fit the clips to their boxes"],
                ["native", "fork.video.size.native", "1:1", "fork.video.zoom.native.hint", "One video pixel per screen pixel (measured on the clip you opened)"],
            ]) {
                const tsButton = document.createElement("button");
                tsButton.type = "button";
                tsButton.className = "ts-video-step";
                tsButton.textContent = this.tsT(tsKey, tsText);
                tsButton.title = this.tsT(tsHintKey, tsHint);
                tsButton.addEventListener("click", () => (tsValue === "fit" ? tsZoom?.tsFit() : tsZoom?.tsNative()));
                tsButtons[tsValue] = tsButton;
                tsGroup.append(tsButton);
            }
            const tsLabel = document.createElement("div");
            tsLabel.className = "ts-fork-zoom-readout";
            tsLabel.title = this.tsT("fork.video.zoom.hint", "Zoom: mouse wheel over the video, drag with the middle button to move around");
            const tsBefore = tsControls.querySelector(".ts-fork-compare-layout")
                || tsControls.querySelector(".ts-compare-close");
            tsControls.insertBefore(tsGroup, tsBefore);
            tsControls.insertBefore(tsLabel, tsBefore);
            tsZoom = tsCreateVideoZoom({
                tsVideos,
                tsSurface: tsGrid,
                tsLockSize: () => false,
                tsOnChange: (tsState) => {
                    tsLabel.textContent = tsReadout(tsState);
                    for (const [tsValue, tsButton] of Object.entries(tsButtons)) {
                        const tsActive = tsValue === "fit" ? tsState.tsAtFit : tsState.tsAtNative;
                        tsButton.dataset.active = String(tsActive);
                        tsButton.setAttribute("aria-pressed", String(tsActive));
                    }
                },
            });
        }
        if (!tsZoom) {
            return tsResult;
        }
        const tsActiveZoom = tsZoom;
        this.tsImageZoomHandler = tsActiveZoom.tsHandler;
        this.tsForkVideoZoom = tsActiveZoom;
        const tsUpstreamCleanup = this.tsStageCleanup;
        this.tsStageCleanup = () => {
            tsActiveZoom.tsDestroy();
            if (this.tsForkVideoZoom === tsActiveZoom) {
                this.tsForkVideoZoom = null;
            }
            if (typeof tsUpstreamCleanup === "function") {
                tsUpstreamCleanup();
            }
        };
        return tsResult;
    };
}
