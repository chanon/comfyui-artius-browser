// obvpm fork: the volume is remembered, and the video players get a volume
// control. One setting for both: the comparison's slider + mute button and
// the single video's (its play bar from the video bar feature; without that
// bar, its native volume and mute) set it, and every video opened after starts
// at it. In a comparison only the clip it was opened from plays sound
// (upstream mutes the others), so that is the clip the control drives.
// Since 1.20.0 upstream remembers the volume itself (same {volume, muted}
// shape) and has a plain "Mute" button in the comparison: the setting is
// upstream's (the fork's old one is carried over once) and that button is
// hidden behind this speaker + slider.
const TS_FORK_VOLUME_KEY = "tsArtiusBrowser.lightboxVolume";
const TS_FORK_OLD_VOLUME_KEY = "tsab.fork.videoVolume";

function tsCarryVolumeSetting() {
    try {
        const tsOld = window.localStorage.getItem(TS_FORK_OLD_VOLUME_KEY);
        if (tsOld !== null && window.localStorage.getItem(TS_FORK_VOLUME_KEY) === null) {
            window.localStorage.setItem(TS_FORK_VOLUME_KEY, tsOld);
        }
        window.localStorage.removeItem(TS_FORK_OLD_VOLUME_KEY);
    } catch {
        // private mode: nothing was saved
    }
}

const TS_FORK_VOLUME_CSS = `
    /* obvpm fork: video comparison volume */
    .ts-fork-volume {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }
    .ts-fork-volume-mute {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 34px;
        padding: 0 8px;
    }
    .ts-fork-volume-mute svg {
        width: 16px;
        height: 16px;
        display: block;
    }
    .ts-fork-volume-range {
        width: 84px;
        margin: 0;
        accent-color: var(--ts-accent);
    }
    /* in the transport, after the time: play | seek | time | volume (upstream
       stacks the transport in one column at 1080 px and below) */
    /* upstream's text Mute button: this speaker does its job */
    .ts-video-transport:has(> .ts-fork-volume) > .ts-video-mute {
        display: none;
    }
    @media (min-width: 1081px) {
        .ts-viewer .ts-video-compare-shell .ts-video-transport:has(> .ts-fork-volume),
        .ts-viewer .ts-video-shell .ts-video-transport:has(> .ts-fork-volume) {
            grid-template-columns: auto minmax(0, 1fr) auto auto;
        }
    }
    @media (max-width: 1080px) {
        .ts-fork-volume {
            justify-self: center;
        }
    }
    /* the row is longer now (volume, Full Screen): the transport gets a line of
       its own sooner than upstream's 1080 px, so the seek bar keeps its width */
    @media (min-width: 1081px) and (max-width: 1280px) {
        .ts-viewer .ts-video-compare-shell[data-fork-layout] .ts-video-compare-controls {
            flex-wrap: wrap;
            justify-content: center;
        }
        .ts-viewer .ts-video-compare-shell[data-fork-layout] .ts-video-transport {
            flex-basis: 100%;
        }
    }
`;

const TS_FORK_SPEAKER = `<path d="M3 6h3l4-3.5v11L6 10H3z" fill="currentColor" stroke="none"/>`;
const TS_FORK_ICON_SOUND = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true">${TS_FORK_SPEAKER}<path d="M12 5.5a3.5 3.5 0 0 1 0 5"/><path d="M13.6 3.6a6 6 0 0 1 0 8.8"/></svg>`;
const TS_FORK_ICON_MUTED = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true">${TS_FORK_SPEAKER}<path d="M11.5 6l3.5 4M15 6l-3.5 4"/></svg>`;

function tsReadVolume() {
    try {
        const tsSaved = JSON.parse(window.localStorage.getItem(TS_FORK_VOLUME_KEY) || "null");
        const tsVolume = Number(tsSaved?.volume);
        return {
            volume: Number.isFinite(tsVolume) ? Math.max(0, Math.min(1, tsVolume)) : 1,
            muted: tsSaved?.muted === true,
        };
    } catch {
        return { volume: 1, muted: false };
    }
}

function tsWriteVolume(tsVideo) {
    try {
        window.localStorage.setItem(TS_FORK_VOLUME_KEY, JSON.stringify({ volume: tsVideo.volume, muted: tsVideo.muted }));
    } catch {
        // private mode: the volume still holds for this video
    }
}

// the saved volume onto a video, and every change to it saved
function tsFollowVolume(tsVideo) {
    const tsSaved = tsReadVolume();
    tsVideo.volume = tsSaved.volume;
    tsVideo.muted = tsSaved.muted;
    tsVideo.addEventListener("volumechange", () => tsWriteVolume(tsVideo));
}

export function tsInstallForkVideoVolume(tsPanel) {
    const tsViewer = tsPanel?.tsViewer;
    if (!tsViewer?.tsRefs?.tsStage || tsViewer.tsForkVideoVolumeInstalled) {
        return;
    }
    tsViewer.tsForkVideoVolumeInstalled = true;
    tsCarryVolumeSetting();
    const tsStyle = document.createElement("style");
    tsStyle.textContent = TS_FORK_VOLUME_CSS;
    tsViewer.shadowRoot.append(tsStyle);

    // mute button + slider driving tsPrimary, appended to the transport
    const tsAddControl = (tsTransport, tsPrimary, tsHint) => {
        const tsGroup = document.createElement("div");
        tsGroup.className = "ts-fork-volume";
        const tsMute = document.createElement("button");
        tsMute.type = "button";
        tsMute.className = "ts-video-step ts-fork-volume-mute";
        const tsRange = document.createElement("input");
        tsRange.type = "range";
        tsRange.className = "ts-fork-volume-range";
        tsRange.min = "0";
        tsRange.max = "1";
        tsRange.step = "0.01";
        tsRange.title = tsHint;
        tsRange.setAttribute("aria-label", tsViewer.tsT("fork.video.volume", "Volume"));
        const tsPaint = () => {
            const tsSilent = tsPrimary.muted || tsPrimary.volume === 0;
            tsMute.innerHTML = tsSilent ? TS_FORK_ICON_MUTED : TS_FORK_ICON_SOUND;
            tsMute.title = tsPrimary.muted
                ? tsViewer.tsT("fork.video.volume.unmute", "Unmute")
                : tsViewer.tsT("fork.video.volume.mute", "Mute");
            tsMute.setAttribute("aria-pressed", String(tsPrimary.muted));
            tsRange.value = String(tsPrimary.muted ? 0 : tsPrimary.volume);
        };
        // saved and painted at once, not only from `volumechange`: that event
        // comes a task later, and closing the viewer right away (upstream's
        // teardown calls load()) drops it
        const tsChanged = () => {
            tsWriteVolume(tsPrimary);
            tsPaint();
        };
        tsMute.addEventListener("click", () => {
            // silent (muted, or the slider at 0) -> sound; unmuting at volume
            // 0 would still be silent, so bring some back
            if (tsPrimary.muted || tsPrimary.volume === 0) {
                if (tsPrimary.volume === 0) {
                    tsPrimary.volume = 0.5;
                }
                tsPrimary.muted = false;
            } else {
                tsPrimary.muted = true;
            }
            tsChanged();
        });
        tsRange.addEventListener("input", () => {
            tsPrimary.volume = Number(tsRange.value);
            tsPrimary.muted = false;
            tsChanged();
        });
        tsPrimary.addEventListener("volumechange", tsPaint);
        tsPaint();
        tsGroup.append(tsMute, tsRange);
        tsTransport.append(tsGroup);
    };

    const tsBindStageInteractions = tsViewer.tsBindStageInteractions;
    tsViewer.tsBindStageInteractions = function (...tsArgs) {
        const tsResult = tsBindStageInteractions.apply(this, tsArgs);
        const tsStage = this.tsRefs.tsStage;
        const tsSingleVideo = tsStage.querySelector(".ts-video-shell video");
        if (tsSingleVideo) {
            tsFollowVolume(tsSingleVideo);
            // the video bar feature's transport (no native controls to do it)
            const tsSingleTransport = tsStage.querySelector(".ts-video-shell .ts-video-transport");
            if (tsSingleTransport && !tsSingleTransport.querySelector(".ts-fork-volume")) {
                tsAddControl(tsSingleTransport, tsSingleVideo, this.tsT("fork.video.volume.single.hint", "Volume"));
            }
            return tsResult;
        }
        const tsCompareShell = tsStage.querySelector(".ts-video-compare-shell");
        const tsControls = tsCompareShell?.querySelector(".ts-video-compare-controls");
        const tsVideos = Array.from(tsCompareShell?.querySelectorAll(".ts-video-compare-grid video") || []);
        // the clip with the sound (upstream unmutes only this one)
        const tsPrimary = tsVideos.find((tsVideo) => tsVideo.dataset.primary === "true") || tsVideos[0];
        if (!tsControls || !tsPrimary || tsControls.querySelector(".ts-fork-volume")) {
            return tsResult;
        }
        tsFollowVolume(tsPrimary);
        tsAddControl(tsControls.querySelector(".ts-video-transport") || tsControls, tsPrimary,
            this.tsT("fork.video.volume.hint", "Volume (of the clip you opened, the one with the sound)"));
        return tsResult;
    };
}
