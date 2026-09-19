// obvpm fork: "Recurse" -- in Tree mode, whether a folder shows the files of
// its subfolders too.
//
// ON is what upstream does: the selected folder and everything under it. OFF
// shows ONLY the files in the selected folder itself. The toggle sits right
// after Flat / Tree and exists only in Tree mode of the Assets section; Flat
// has no selected folder, and the workflow browser is a different listing.
//
// OFF is sent to the server as `recurse=0` on the search request. The server
// side of this is the fork's one edit to upstream's Python (ts_routes.py reads
// the parameter, ts_db_query.py narrows the folder clause); a server without
// it ignores the parameter and simply keeps recursing.
//
// Kept in this browser's localStorage, like "Only show Assets": the pack's
// settings file accepts a fixed list of keys.
//
// The panel is hooked on the INSTANCE, its file is not edited:
//   - tsBuildSearchParams: every asset request is built there.
//   - tsRenderModeButtons and tsRenderToolbarForSection: the panel calls the
//     first when the mode changes and the second when the section does, so
//     the toggle's visibility follows those two calls.

const TS_FORK_RECURSE_KEY = "tsab.fork.recurse";

function tsReadStored() {
    try {
        return window.localStorage?.getItem(TS_FORK_RECURSE_KEY) !== "0";    // default ON
    } catch (tsError) {
        return true;
    }
}

function tsWriteStored(tsOn) {
    try {
        window.localStorage?.setItem(TS_FORK_RECURSE_KEY, tsOn ? "1" : "0");
    } catch (tsError) {
        // not persisted; still works until the page reloads
    }
}

export function tsInstallForkRecurse(tsPanel) {
    const tsRefs = tsPanel?.tsRefs;
    const tsRow = tsRefs?.tsToolbarMain;
    const tsModeGroup = tsRow && [...tsRow.children]
        .find((tsChild) => tsChild.matches?.(".ts-mode-group"));
    if (!tsModeGroup || tsRefs.tsForkRecurse) {
        return;
    }
    const tsT = (tsKey, tsFallback) => tsPanel.tsT?.(tsKey, tsFallback) || tsFallback;
    let tsOn = tsReadStored();

    const tsToggle = document.createElement("button");
    tsToggle.type = "button";
    tsToggle.className = "ts-toggle-button ts-fork-recurse";
    const tsLabel = document.createElement("span");
    tsToggle.append(tsLabel);
    tsModeGroup.after(tsToggle);

    const tsApplies = () => tsPanel.tsState?.tsMode === "tree"
        && !tsPanel.tsIsWorkflowSection?.();

    const tsRender = () => {
        const tsShown = tsApplies();
        tsToggle.hidden = !tsShown;
        tsToggle.style.display = tsShown ? "" : "none";     // beats inline-flex
        tsToggle.dataset.active = String(tsOn);
        tsToggle.setAttribute("aria-pressed", String(tsOn));
        tsLabel.textContent = tsT("fork.recurse", "Recurse");
        tsToggle.title = tsOn
            ? tsT("fork.recurseOn", "On: a folder also shows the files of its subfolders. Click to show only the files in the selected folder.")
            : tsT("fork.recurseOff", "Off: only the files in the selected folder are shown. Click to include its subfolders.");
    };

    const tsBuildSearchParams = tsPanel.tsBuildSearchParams;
    if (typeof tsBuildSearchParams === "function") {
        tsPanel.tsBuildSearchParams = function tsForkBuildSearchParams(...tsArgs) {
            const tsParams = tsBuildSearchParams.apply(this, tsArgs);
            // only where the toggle is on screen, and only for the listing the
            // panel is showing: a request that overrides the view or the
            // folder is somebody's own query, not the tree the user looks at
            const tsOverrides = tsArgs[1] || {};
            const tsOwnQuery = "view" in tsOverrides || "folder" in tsOverrides;
            if (!tsOn && tsApplies() && !tsOwnQuery) {
                tsParams?.set?.("recurse", "0");
            }
            return tsParams;
        };
    }

    for (const tsName of ["tsRenderModeButtons", "tsRenderToolbarForSection"]) {
        const tsOriginal = tsPanel[tsName];
        if (typeof tsOriginal !== "function") {
            continue;
        }
        tsPanel[tsName] = function tsForkFollowRender(...tsArgs) {
            const tsResult = tsOriginal.apply(this, tsArgs);
            tsRender();
            return tsResult;
        };
    }

    tsToggle.addEventListener("click", () => {
        tsOn = !tsOn;
        tsWriteStored(tsOn);
        tsRender();
        void tsPanel.tsFetchAssets?.(true);      // the same reset a folder click does
    });

    tsRefs.tsForkRecurse = tsToggle;
    tsRender();
}
