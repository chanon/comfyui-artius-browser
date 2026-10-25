// obvpm fork: in a video comparison, clips with the same file name show the
// folders in front of the name, back to the first folder where their paths
// differ (test_degrad5/base/clip_00001.mp4 and test_degrad5/fl2va/clip_00001.mp4
// read "base/clip_00001.mp4" and "fl2va/clip_00001.mp4"). Every clip of such a
// group gets the same number of folders, so the names line up; a clip whose
// name is unique keeps the bare name. The label's tooltip has the full path.
//
// Upstream builds the labels from item.filename inside the stage markup; this
// rewrites the label text after the stage is bound (a tsBindStageInteractions
// wrap on the viewer instance, installed before the video-compare feature so
// its reorder hint is still added to the tooltip afterwards).

function tsForkFolders(tsItem) {
    const tsFolders = String(tsItem?.folder_path || "").split(/[\\/]+/).filter(Boolean);
    // the root (Output, Input, a custom root) is the outermost "folder", so two
    // roots holding the same relative path still tell apart
    return [String(tsItem?.root_label || tsItem?.root_id || ""), ...tsFolders].filter(Boolean);
}

// The name shown for each item, in order.
export function tsForkCompareNames(tsItems) {
    const tsList = Array.isArray(tsItems) ? tsItems : [];
    const tsNames = tsList.map((tsItem) => String(tsItem?.filename || ""));
    const tsGroups = new Map();
    tsList.forEach((tsItem, tsIndex) => {
        const tsKey = tsNames[tsIndex].toLowerCase();
        if (!tsKey) {
            return;
        }
        if (!tsGroups.has(tsKey)) {
            tsGroups.set(tsKey, []);
        }
        tsGroups.get(tsKey).push(tsIndex);
    });
    for (const tsIndexes of tsGroups.values()) {
        if (tsIndexes.length < 2) {
            continue;
        }
        const tsFolders = tsIndexes.map((tsIndex) => tsForkFolders(tsList[tsIndex]));
        const tsDeepest = Math.max(...tsFolders.map((tsPath) => tsPath.length));
        // the fewest folders (counted from the file outwards) that make every
        // clip of the group read differently; all of them if nothing does
        let tsDepth = tsDeepest;
        for (let tsTry = 1; tsTry <= tsDeepest; tsTry += 1) {
            const tsSeen = new Set(tsFolders.map((tsPath) => tsPath.slice(-tsTry).join("/").toLowerCase()));
            if (tsSeen.size === tsFolders.length) {
                tsDepth = tsTry;
                break;
            }
        }
        tsIndexes.forEach((tsIndex, tsAt) => {
            const tsShown = tsFolders[tsAt].slice(-tsDepth);
            if (tsShown.length) {
                tsNames[tsIndex] = `${tsShown.join("/")}/${tsNames[tsIndex]}`;
            }
        });
    }
    return tsNames;
}

function tsForkFullPath(tsItem) {
    return [...tsForkFolders(tsItem), String(tsItem?.filename || "")].filter(Boolean).join("/");
}

export function tsInstallForkCompareNames(tsPanel) {
    const tsViewer = tsPanel?.tsViewer;
    if (!tsViewer?.tsRefs?.tsStage || tsViewer.tsForkCompareNamesInstalled) {
        return;
    }
    tsViewer.tsForkCompareNamesInstalled = true;
    const tsBindStageInteractions = tsViewer.tsBindStageInteractions;
    tsViewer.tsBindStageInteractions = function (...tsArgs) {
        const tsResult = tsBindStageInteractions.apply(this, tsArgs);
        const tsLabels = Array.from(this.tsRefs.tsStage.querySelectorAll(
            ".ts-video-compare-grid .ts-video-compare-card .ts-video-compare-label"));
        // the cards are built from tsCompareItems, in that order (up to four)
        const tsItems = (Array.isArray(this.tsCompareItems) ? this.tsCompareItems : []).slice(0, tsLabels.length);
        if (tsLabels.length < 2 || tsItems.length !== tsLabels.length) {
            return tsResult;
        }
        const tsNames = tsForkCompareNames(tsItems);
        tsLabels.forEach((tsLabel, tsIndex) => {
            if (tsNames[tsIndex] && tsNames[tsIndex] !== tsItems[tsIndex].filename) {
                tsLabel.textContent = tsNames[tsIndex];
                tsLabel.title = tsForkFullPath(tsItems[tsIndex]);
            }
        });
        return tsResult;
    };
}
