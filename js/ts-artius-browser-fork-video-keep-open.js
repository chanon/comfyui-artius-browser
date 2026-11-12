// obvpm fork: a click that just misses the single video's play bar no longer
// closes the viewer. Upstream closes the viewer on a click on the empty stage
// around a video (the "outside"), and the play bar sits at the bottom of that
// stage with only a thin strip of stage under it, so a click a little below
// the seek bar (or beside the bar) landed on "outside".
// Rule: on a single video, a click on the empty stage level with the play bar
// or lower never closes. Above the bar, a click beside the picture still
// closes, as before. Comparisons are unchanged (upstream never closes them on
// a stage click).
// Upstream's handler is a bubble listener on the viewer root inside its
// closure; this is a capture listener on the same root, which runs first and
// stops the click there. Nothing else listens for clicks on the stage.

export function tsInstallForkVideoKeepOpen(tsPanel) {
    const tsViewer = tsPanel?.tsViewer;
    const tsRoot = tsViewer?.tsRefs?.tsRoot;
    if (!tsRoot || !tsViewer.tsRefs.tsStage || tsViewer.tsForkVideoKeepOpenInstalled) {
        return;
    }
    tsViewer.tsForkVideoKeepOpenInstalled = true;

    tsRoot.addEventListener("click", (tsEvent) => {
        const tsStage = tsViewer.tsRefs.tsStage;
        if (tsEvent.button !== 0 || tsStage.dataset.kind !== "video" || tsRoot.dataset.compare === "true") {
            return;
        }
        if (tsEvent.target !== tsStage && tsEvent.target !== tsStage.parentElement) {
            return;
        }
        const tsControls = tsStage.querySelector(".ts-video-shell .ts-video-controls");
        if (!tsControls) {
            return;
        }
        if (tsEvent.clientY >= tsControls.getBoundingClientRect().top) {
            tsEvent.stopPropagation();
        }
    }, true);
}
