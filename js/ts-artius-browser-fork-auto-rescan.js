// obvpm fork: new files show up without pressing Rescan.
//
// - The server watches the asset folders itself (tsab/ts_fork_watcher.py:
//   Windows reports each file change; a folder is rescanned once it has been
//   quiet for 1.5 s) and the panel only listens for the scan's result. The
//   panel never polls. Where the server cannot watch (not Windows), new files
//   show up after a generation (upstream's autoscan), a folder click or Rescan.
// - Clicking a folder in the tree rescans THAT folder (the server's folder
//   rescan: only its subtree is walked, only its rows can be removed).
// - Both follow the Autoscan setting (off = only the Rescan button).
// - The progress bar is an overlay at the bottom of the grid instead of a row
//   under the toolbar, so a scan no longer pushes the toolbar or the grid down.
//   A folder rescan shows it only while it actually indexes new files.
//
// The server marks a folder rescan's status with its folder (status.folder);
// a scan of whole roots carries null there, so the Rescan button, the
// post-generation autoscan and Rebuild Cache behave exactly as upstream.
import { tsPostJSON, tsRouteBase } from "./ts-artius-browser-api.js";

function tsIsFolderScan(tsStatus) {
    return Boolean(tsStatus) && tsStatus.folder !== null && tsStatus.folder !== undefined;
}

export function tsInstallForkAutoRescan(tsPanel) {
    const tsRefs = tsPanel.tsRefs;
    let tsInFlight = false;

    // ---- the progress bar as an overlay at the bottom of the grid ----
    const tsGalleryWrap = tsPanel.shadowRoot.querySelector(".ts-gallery-wrap");
    if (tsRefs.tsProgress && tsGalleryWrap) {
        tsRefs.tsProgress.classList.add("ts-fork-progress-dock");
        tsGalleryWrap.append(tsRefs.tsProgress);
    }

    const tsLocations = () => {
        const tsState = tsPanel.tsState;
        if (tsState.tsRootId === "all") {
            // every root, each as a folder scan of its top
            const tsRoots = Array.isArray(tsState.tsRoots) ? tsState.tsRoots : [];
            const tsIds = tsRoots.map((tsRoot) => tsRoot?.root_id).filter(Boolean);
            return (tsIds.length ? tsIds : ["output", "input"]).map((tsId) => ({ root_id: tsId, folder: "" }));
        }
        const tsFolder = tsState.tsMode === "tree" ? String(tsState.tsFolder || "") : "";
        return [{ root_id: tsState.tsRootId, folder: tsFolder }];
    };

    const tsCanScan = () =>
        Boolean(tsPanel.tsState?.tsAutoscan)
        && tsPanel.isConnected
        && !tsPanel.tsIsWorkflowSection()
        && !tsPanel.tsState.tsScanStatus?.running;

    const tsScanFolders = async (tsList) => {
        if (tsInFlight || !tsCanScan()) {
            return;
        }
        tsInFlight = true;
        try {
            for (const tsLocation of tsList) {
                if (tsLocation.root_id) {
                    await tsPostJSON(`${tsRouteBase}/rescan`, tsLocation);
                }
            }
        } catch (tsError) {
            console.warn("Artius Browser (obvpm fork): folder rescan failed", tsError);
        } finally {
            tsInFlight = false;
        }
    };

    // ---- a folder click rescans that folder ----
    const tsOrigTreeClick = tsPanel.tsHandleTreeClick;
    tsPanel.tsHandleTreeClick = function (tsEvent, ...tsRest) {
        const tsResult = tsOrigTreeClick.call(this, tsEvent, ...tsRest);
        if (tsEvent?.target?.closest?.("[data-tree-folder]") && !tsEvent.target.closest("[data-toggle-key]")) {
            void tsScanFolders(tsLocations());
        }
        return tsResult;
    };

    // ---- a folder rescan that found nothing changes nothing on screen ----
    const tsOrigScanEvent = tsPanel.tsHandleScanEvent;
    tsPanel.tsHandleScanEvent = function (tsEvent, tsShouldRefresh, ...tsRest) {
        const tsStatus = this.tsReadEventDetail?.(tsEvent)?.status;
        if (tsShouldRefresh && tsIsFolderScan(tsStatus) && !(Number(tsStatus.changed) > 0 || Number(tsStatus.deleted) > 0)) {
            return tsOrigScanEvent.call(this, tsEvent, false, ...tsRest);
        }
        return tsOrigScanEvent.call(this, tsEvent, tsShouldRefresh, ...tsRest);
    };

    // ---- ... and shows the bar only while it indexes new files ----
    const tsOrigRenderProgress = tsPanel.tsRenderProgress;
    tsPanel.tsRenderProgress = function (...tsArgs) {
        const tsResult = tsOrigRenderProgress.apply(this, tsArgs);
        const tsStatus = this.tsState.tsScanStatus;
        if (tsIsFolderScan(tsStatus) && tsStatus.running && !(tsStatus.phase === "hash" && Number(tsStatus.total_candidates) > 0)) {
            this.tsRefs.tsProgress.dataset.visible = "false";
        }
        return tsResult;
    };

    // ---- a folder check never greys out Rescan / Rebuild Cache, and never blocks them ----
    const tsOrigSelectionButtons = tsPanel.tsRenderSelectionButtons;
    tsPanel.tsRenderSelectionButtons = function (...tsArgs) {
        const tsResult = tsOrigSelectionButtons.apply(this, tsArgs);
        if (tsIsFolderScan(this.tsState.tsScanStatus) && !this.tsIsWorkflowSection()) {
            this.tsRefs.tsRescan.disabled = false;
            this.tsRefs.tsRebuildCache.disabled = false;
        }
        return tsResult;
    };
    for (const tsName of ["tsRequestRescan", "tsRequestRebuildCache"]) {
        const tsOrig = tsPanel[tsName];
        if (typeof tsOrig !== "function") {
            continue;
        }
        tsPanel[tsName] = function (...tsArgs) {
            // upstream returns at once while a scan runs; a folder check is
            // not a reason to ignore the button (the server queues the scan)
            if (tsIsFolderScan(this.tsState.tsScanStatus) && this.tsState.tsScanStatus.running) {
                this.tsState.tsScanStatus = null;
            }
            return tsOrig.apply(this, tsArgs);
        };
    }
}
