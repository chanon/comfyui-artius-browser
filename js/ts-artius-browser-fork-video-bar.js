// obvpm fork: the single video gets the video comparison's play bar instead of
// the browser's own controls -- one row: Play | seek | time (| volume) | first
// frame | previous frame | Frame N | next frame | last frame | Loop | 1:1 |
// Fit | Centered | zoom readout (| Full Screen). The volume and Full Screen
// come from their own features, which look for this bar's transport. A click on
// the picture plays / pauses (the browser's controls did that); Space is
// upstream's (since 1.20.0 it presses the stage's .ts-video-play-toggle, which
// is this bar's Play button).
// Upstream's frame stepper, First / Last frame buttons and Loop toggle (1.20.1)
// are left as they are -- the Loop is only moved to the end of the frame
// steps, as in the comparison. This adds the transport and drops the
// `controls` attribute from the <video> in the stage markup.
import { tsFormatTime } from "./ts-artius-browser-viewer-format.js";

// the fork's own single-video Loop (before upstream had one): carried over
// once into upstream's setting, which now drives every player's Loop
const TS_FORK_VIDEO_LOOP_KEY = "tsab.fork.videoLoop";
const TS_UPSTREAM_LOOP_KEY = "tsArtiusBrowser.lightboxLoop";

function tsCarryLoopSetting() {
    try {
        const tsOld = window.localStorage.getItem(TS_FORK_VIDEO_LOOP_KEY);
        if (tsOld !== null && window.localStorage.getItem(TS_UPSTREAM_LOOP_KEY) === null) {
            window.localStorage.setItem(TS_UPSTREAM_LOOP_KEY, tsOld === "1" ? "1" : "0");
        }
        window.localStorage.removeItem(TS_FORK_VIDEO_LOOP_KEY);
    } catch {
        // private mode: nothing was saved
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
    .ts-video-shell .ts-video-controls:has(> .ts-video-transport) > .ts-video-loop,
    .ts-video-shell .ts-video-controls:has(> .ts-video-transport) > .ts-fork-video-size,
    .ts-video-shell .ts-video-controls:has(> .ts-video-transport) > .ts-fork-zoom-readout {
        flex: none;
        white-space: nowrap;
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
    /* a long row: the transport gets a line of its own before the seek bar
       gets short. Measured on the player's own width, not the window's (the
       info panel takes a varying share of the window). The shell's width
       never comes from its content, so the containment changes nothing else. */
    .ts-video-shell:has(> .ts-video-controls > .ts-video-transport) {
        container: ts-fork-video-bar / inline-size;
    }
    @container ts-fork-video-bar (max-width: 1300px) {
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
    tsCarryLoopSetting();

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

    const tsBindStageInteractions = tsViewer.tsBindStageInteractions;
    tsViewer.tsBindStageInteractions = function (...tsArgs) {
        const tsResult = tsBindStageInteractions.apply(this, tsArgs);
        const tsShell = this.tsRefs.tsStage.querySelector(".ts-video-shell");
        const tsVideo = tsShell?.querySelector("video");
        const tsControls = tsShell?.querySelector(".ts-video-controls");
        // the markup still has its controls (upstream changed it): leave it be
        if (!tsVideo || !tsControls || tsVideo.controls || tsControls.querySelector(".ts-video-transport")) {
            return tsResult;
        }
        tsVideo.dataset.forkBar = "true";

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
        tsSeek.setAttribute("aria-label", this.tsT("label.playbackPosition", "Playback position"));
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

        // upstream's Loop: after the frame steps, before the size buttons (as
        // in the comparison)
        const tsLoopButton = tsControls.querySelector(".ts-video-loop");
        if (tsLoopButton) {
            tsLoopButton.classList.add("ts-video-step");      // the row's button size
            tsControls.insertBefore(tsLoopButton, tsControls.querySelector(".ts-fork-video-size"));
        }

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
            if (typeof tsUpstreamCleanup === "function") {
                tsUpstreamCleanup();
            }
        };
        return tsResult;
    };
}
