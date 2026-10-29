// obvpm fork: the single video gets the video comparison's play bar instead of
// the browser's own controls -- one row: Play | seek | time (| volume) |
// previous frame | Frame N | next frame | Loop | 1:1 | Fit | Centered | zoom
// readout (| Full Screen). The volume and Full Screen come from their own
// features, which look for this bar's transport. A click on the picture plays
// / pauses, and so does Space (the browser's controls did both).
// Upstream's frame stepper (its buttons, its frame label, the arrow keys) is
// left as it is: this only adds the transport and the Loop toggle, and drops
// the `controls` attribute from the <video> in the stage markup.
import { tsFormatTime } from "./ts-artius-browser-viewer-format.js";

const TS_FORK_VIDEO_LOOP_KEY = "tsab.fork.videoLoop";

function tsReadLoop() {
    try {
        return window.localStorage.getItem(TS_FORK_VIDEO_LOOP_KEY) === "1";
    } catch {
        return false;
    }
}

function tsWriteLoop(tsOn) {
    try {
        window.localStorage.setItem(TS_FORK_VIDEO_LOOP_KEY, tsOn ? "1" : "0");
    } catch {
        // private mode: the choice still holds for this page
    }
}

const TS_FORK_VIDEO_BAR_CSS = `
    /* obvpm fork: the single video's play bar (the comparison's row) */
    .ts-video-shell .ts-video-controls:has(> .ts-video-transport) {
        width: 100%;
        min-width: 0;
        flex-wrap: nowrap;
        justify-content: flex-start;
        gap: 10px;
    }
    .ts-video-shell .ts-video-controls > .ts-video-transport {
        flex: 1 1 auto;
        min-width: 0;
    }
    .ts-video-shell .ts-video-controls:has(> .ts-video-transport) > .ts-video-step,
    .ts-video-shell .ts-video-controls:has(> .ts-video-transport) > .ts-fork-video-size,
    .ts-video-shell .ts-video-controls:has(> .ts-video-transport) > .ts-fork-zoom-readout {
        flex: none;
    }
    .ts-video-shell .ts-video-controls:has(> .ts-video-transport) > .ts-video-frame {
        flex: none;
        min-width: 92px;
        padding: 5px 8px;
    }
    .ts-video-shell .ts-video-controls:has(> .ts-video-transport) > .ts-fork-video-size {
        margin-left: 0;
    }
    .ts-video-shell video[data-fork-bar] {
        cursor: pointer;
    }
    .ts-fork-video-loop {
        flex: none;
        white-space: nowrap;
    }
    .ts-fork-video-loop[data-active="true"] {
        border-color: var(--ts-accent);
        background: color-mix(in srgb, var(--ts-accent) 18%, var(--ts-bg-2));
    }
    /* a long row: the transport gets a line of its own before the seek bar
       gets short. Measured on the player's own width, not the window's (the
       info panel takes a varying share of the window). The shell's width
       never comes from its content, so the containment changes nothing else. */
    .ts-video-shell:has(> .ts-video-controls > .ts-video-transport) {
        container: ts-fork-video-bar / inline-size;
    }
    @container ts-fork-video-bar (max-width: 1200px) {
        .ts-video-shell .ts-video-controls:has(> .ts-video-transport) {
            flex-wrap: wrap;
            justify-content: center;
        }
        .ts-video-shell .ts-video-controls > .ts-video-transport {
            flex-basis: 100%;
        }
    }
`;

// the single video's <video ... controls ...>: the attribute goes, the bar replaces it
const TS_FORK_SINGLE_VIDEO = /(<div class="ts-video-shell">[\s\S]*?<video\b[^>]*?)\scontrols\b/;

export function tsInstallForkVideoBar(tsPanel) {
    const tsViewer = tsPanel?.tsViewer;
    if (!tsViewer?.tsRefs?.tsStage || tsViewer.tsForkVideoBarInstalled) {
        return;
    }
    tsViewer.tsForkVideoBarInstalled = true;
    const tsStyle = document.createElement("style");
    tsStyle.textContent = TS_FORK_VIDEO_BAR_CSS;
    tsViewer.shadowRoot.append(tsStyle);

    let tsLoop = tsReadLoop();
    // the single video on screen with this bar (Space plays / pauses it)
    let tsActiveVideo = null;

    const tsBuildStageMarkup = tsViewer.tsBuildStageMarkup;
    tsViewer.tsBuildStageMarkup = function (...tsArgs) {
        const tsMarkup = tsBuildStageMarkup.apply(this, tsArgs);
        return typeof tsMarkup === "string" ? tsMarkup.replace(TS_FORK_SINGLE_VIDEO, "$1") : tsMarkup;
    };

    const tsToggle = (tsVideo) => {
        if (tsVideo.paused || tsVideo.ended) {
            void tsVideo.play()?.catch?.(() => {});
        } else {
            tsVideo.pause();
        }
    };

    const tsHandleKeydown = tsViewer.tsHandleKeydown;
    tsViewer.tsHandleKeydown = function (tsEvent) {
        if (tsEvent.key === " " && tsActiveVideo?.isConnected && !tsEvent.ctrlKey && !tsEvent.metaKey && !tsEvent.altKey) {
            // a focused button / field keeps its own Space
            const tsTarget = tsEvent.composedPath?.()[0] || tsEvent.target;
            if (!tsTarget?.closest?.("button, input, select, textarea, [contenteditable]")) {
                tsEvent.preventDefault();
                tsToggle(tsActiveVideo);
                return;
            }
        }
        return tsHandleKeydown.call(this, tsEvent);
    };

    const tsBindStageInteractions = tsViewer.tsBindStageInteractions;
    tsViewer.tsBindStageInteractions = function (...tsArgs) {
        const tsResult = tsBindStageInteractions.apply(this, tsArgs);
        const tsShell = this.tsRefs.tsStage.querySelector(".ts-video-shell");
        const tsVideo = tsShell?.querySelector("video");
        const tsControls = tsShell?.querySelector(".ts-video-controls");
        tsActiveVideo = null;
        // the markup still has its controls (upstream changed it): leave it be
        if (!tsVideo || !tsControls || tsVideo.controls || tsControls.querySelector(".ts-video-transport")) {
            return tsResult;
        }
        tsVideo.dataset.forkBar = "true";
        tsActiveVideo = tsVideo;

        const tsTransport = document.createElement("div");
        tsTransport.className = "ts-video-transport";
        const tsPlay = document.createElement("button");
        tsPlay.type = "button";
        tsPlay.className = "ts-video-play-toggle";
        const tsSeek = document.createElement("input");
        tsSeek.type = "range";
        tsSeek.className = "ts-video-seek";
        tsSeek.min = "0";
        tsSeek.max = "0";
        tsSeek.step = "0.001";
        tsSeek.value = "0";
        tsSeek.setAttribute("aria-label", this.tsT("fork.video.seek", "Position"));
        const tsTime = document.createElement("div");
        tsTime.className = "ts-video-time";
        tsTransport.append(tsPlay, tsSeek, tsTime);
        tsControls.prepend(tsTransport);

        let tsSeeking = false;
        let tsKey = "";
        const tsPaint = () => {
            const tsDuration = Number.isFinite(tsVideo.duration) && tsVideo.duration > 0 ? tsVideo.duration : 0;
            const tsNow = Math.max(0, Number(tsVideo.currentTime || 0));
            const tsPlaying = !tsVideo.paused && !tsVideo.ended;
            const tsText = tsPlaying ? this.tsT("button.pause", "Pause") : this.tsT("button.play", "Play");
            const tsTimeText = `${tsFormatTime(tsNow)} / ${tsFormatTime(tsDuration)}`;
            // runs every animation frame while playing: write only what changed
            const tsNextKey = `${tsText}|${tsTimeText}|${tsDuration}`;
            if (tsNextKey !== tsKey) {
                tsKey = tsNextKey;
                tsPlay.textContent = tsText;
                tsTime.textContent = tsTimeText;
                tsSeek.max = String(tsDuration);
                tsSeek.disabled = tsDuration <= 0;
            }
            if (!tsSeeking) {
                tsSeek.value = String(tsDuration > 0 ? Math.min(tsDuration, tsNow) : 0);
            }
        };
        let tsFrame = 0;
        const tsTick = () => {
            tsPaint();
            tsFrame = !tsVideo.paused && !tsVideo.ended && tsVideo.isConnected ? window.requestAnimationFrame(tsTick) : 0;
        };
        const tsStartTick = () => {
            if (!tsFrame) {
                tsFrame = window.requestAnimationFrame(tsTick);
            }
        };
        tsPlay.addEventListener("click", () => tsToggle(tsVideo));
        tsVideo.addEventListener("click", (tsEvent) => {
            if (tsEvent.button === 0) {
                tsToggle(tsVideo);
            }
        });
        // scrubbing pauses the picture under the thumb, and playback resumes
        // where it is let go if it was playing
        let tsResume = false;
        tsSeek.addEventListener("pointerdown", () => {
            tsSeeking = true;
            tsResume = !tsVideo.paused && !tsVideo.ended;
            if (tsResume) {
                tsVideo.pause();
            }
        });
        tsSeek.addEventListener("input", () => {
            tsVideo.currentTime = Number(tsSeek.value);
            tsPaint();
        });
        tsSeek.addEventListener("change", () => {
            tsSeeking = false;
            if (tsResume) {
                tsResume = false;
                void tsVideo.play()?.catch?.(() => {});
            }
            tsPaint();
        });
        for (const tsName of ["loadedmetadata", "durationchange", "timeupdate", "seeked", "pause", "ended"]) {
            tsVideo.addEventListener(tsName, tsPaint);
        }
        tsVideo.addEventListener("play", () => {
            tsPaint();
            tsStartTick();
        });

        const tsLoopButton = document.createElement("button");
        tsLoopButton.type = "button";
        tsLoopButton.className = "ts-video-step ts-fork-video-loop";
        tsLoopButton.textContent = this.tsT("fork.video.compare.loop", "Loop");
        const tsPaintLoop = () => {
            tsVideo.loop = tsLoop;
            tsLoopButton.dataset.active = String(tsLoop);
            tsLoopButton.setAttribute("aria-pressed", String(tsLoop));
            tsLoopButton.title = tsLoop
                ? this.tsT("fork.video.loop.on", "Looping: playback starts over at the end")
                : this.tsT("fork.video.loop.off", "Play once and stop at the end");
        };
        tsLoopButton.addEventListener("click", () => {
            tsLoop = !tsLoop;
            tsWriteLoop(tsLoop);
            tsPaintLoop();
        });
        tsPaintLoop();
        // after the frame steps, before the size buttons (as in the comparison)
        tsControls.insertBefore(tsLoopButton, tsControls.querySelector(".ts-fork-video-size"));

        tsPaint();
        if (!tsVideo.paused) {
            tsStartTick();
        }
        const tsUpstreamCleanup = this.tsStageCleanup;
        this.tsStageCleanup = () => {
            if (tsFrame) {
                window.cancelAnimationFrame(tsFrame);
                tsFrame = 0;
            }
            if (tsActiveVideo === tsVideo) {
                tsActiveVideo = null;
            }
            if (typeof tsUpstreamCleanup === "function") {
                tsUpstreamCleanup();
            }
        };
        return tsResult;
    };
}
