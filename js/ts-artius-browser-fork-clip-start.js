// obvpm fork: clips whose first frame is not at 0:00.
//
// A clip cut out of a longer one without re-timing it (ffmpeg -c copy, or a
// select filter without setpts) keeps its old timestamps: frames 51-72 of a
// 24 fps clip start at 2.125 s. Chrome then reports the whole 0 .. end range
// as the clip's duration, shows the first frame for the empty lead-in, and
// moves the element to the first frame by itself once the first frame is
// loaded (currentTime reads 2.125 at "loadeddata", whatever was asked before).
// In a comparison the other clips ran 0 .. 0.9 s against that frozen lead-in,
// and once playing the clip jumped ahead 2 s, so the sync kept seeking it back
// ("Syncing clips..." and a stutter).
//
// The comparison works in CLIP time instead: the element's time minus where
// its first frame sits. That start is read at "loadeddata": the time Chrome
// put the element on, unless a seek we asked for before the load explains it.

const TS_START_KEY = "tsForkClipStart";
const TS_TARGET_KEY = "tsForkClipSeekTarget";

export function tsClipStart(tsVideo) {
    const tsStart = Number(tsVideo?.[TS_START_KEY]);
    return Number.isFinite(tsStart) && tsStart > 0 ? tsStart : 0;
}

export function tsClipTime(tsVideo) {
    return Math.max(0, Number(tsVideo?.currentTime || 0) - tsClipStart(tsVideo));
}

// the clip's own length; 0 while unknown
export function tsClipDuration(tsVideo) {
    const tsDuration = Number(tsVideo?.duration || 0);
    if (!Number.isFinite(tsDuration) || tsDuration <= 0) {
        return 0;
    }
    return Math.max(0, tsDuration - tsClipStart(tsVideo));
}

export function tsSetClipTime(tsVideo, tsTime) {
    const tsRaw = Math.max(0, Number(tsTime) || 0) + tsClipStart(tsVideo);
    if (tsVideo.readyState < 2) {
        tsVideo[TS_TARGET_KEY] = tsRaw;
    }
    tsVideo.currentTime = tsRaw;
}

// Call once per element, before anything seeks it.
export function tsWatchClipStart(tsVideo) {
    if (!tsVideo || tsVideo.tsForkClipStartWatched) {
        return;
    }
    tsVideo.tsForkClipStartWatched = true;
    if (tsVideo.readyState >= 2) {
        return;   // already loaded: nothing to read any more, start stays 0
    }
    tsVideo.addEventListener("loadeddata", () => {
        const tsNow = Number(tsVideo.currentTime || 0);
        const tsAsked = Number(tsVideo[TS_TARGET_KEY]);
        delete tsVideo[TS_TARGET_KEY];
        // a seek we asked for and got is not a start
        if (Number.isFinite(tsAsked) && Math.abs(tsNow - tsAsked) < 0.01) {
            return;
        }
        if (tsNow > 0.001) {
            tsVideo[TS_START_KEY] = tsNow;
            tsVideo.dispatchEvent(new Event("tsforkclipstart"));
        }
    }, { once: true });
}
