// obvpm fork: the sort menu's one "Date" becomes "Modified" and "Created".
//
// Upstream's "Date" sorts by created_at (the file's creation time, kept from
// the first index). The server has had a second date key all along -- `mtime`,
// indexed -- that the panel never offered. But the panel's saved settings only
// know created_at / filename / size_bytes (client AND server normalise against
// that list), so "mtime" must never reach the panel's state:
//   - both date options carry the VALUE created_at, which is all upstream sees
//     and saves; which of the two is meant is the fork's own preference
//     (localStorage, like its other display options);
//   - the request is rewritten on the way out: sort=created_at -> sort=mtime.
// The Workflows section sorts in the browser, by the file's modified time, so
// there the single option is only renamed to say what it does.
const TS_FORK_SORT_DATE_KEY = "tsab.fork.sortDate";

function tsReadStored() {
    try {
        return window.localStorage?.getItem(TS_FORK_SORT_DATE_KEY) === "mtime" ? "mtime" : "created_at";
    } catch (tsError) {
        return "created_at";
    }
}

function tsWriteStored(tsWhich) {
    try {
        window.localStorage?.setItem(TS_FORK_SORT_DATE_KEY, tsWhich);
    } catch (tsError) {
        // not persisted; the choice still holds until the page reloads
    }
}

export function tsInstallForkSortDates(tsPanel) {
    const tsSelect = tsPanel?.tsRefs?.tsSortSelect;
    if (!tsSelect || typeof tsPanel.tsRenderSortOptions !== "function" || tsPanel.tsRefs.tsForkSortDates) {
        return;
    }
    tsPanel.tsRefs.tsForkSortDates = true;
    let tsWhich = tsReadStored();

    const tsPaint = () => {
        const tsDate = Array.from(tsSelect.options).find((tsOption) => tsOption.value === "created_at");
        if (!tsDate) {
            return;
        }
        if (tsPanel.tsIsWorkflowSection?.()) {
            tsDate.textContent = tsPanel.tsT("fork.sort.modified", "Modified");
            return;
        }
        tsDate.textContent = tsPanel.tsT("fork.sort.created", "Created");
        const tsModified = document.createElement("option");
        tsModified.value = "created_at";            // what upstream sees and saves
        tsModified.dataset.forkSort = "mtime";
        tsModified.textContent = tsPanel.tsT("fork.sort.modified", "Modified");
        tsDate.before(tsModified);
        // two options share the value, so the selection is set by index
        if (tsPanel.tsState.tsSortKey === "created_at") {
            (tsWhich === "mtime" ? tsModified : tsDate).selected = true;
        }
    };

    const tsRenderSortOptions = tsPanel.tsRenderSortOptions;
    tsPanel.tsRenderSortOptions = function tsForkRenderSortOptions(...tsArgs) {
        const tsResult = tsRenderSortOptions.apply(this, tsArgs);
        tsPaint();
        this.tsResizeSelectToCurrent?.(tsSelect);
        return tsResult;
    };

    // Which date is meant is read off the menu itself, so nothing depends on
    // this listener running before the panel's own (which starts the fetch).
    const tsSync = () => {
        const tsPicked = tsSelect.selectedOptions?.[0];
        if (tsPicked?.value !== "created_at" || tsPanel.tsIsWorkflowSection?.()
            || !Array.from(tsSelect.options).some((tsOption) => tsOption.dataset.forkSort)) {
            return tsWhich;                 // not on a date, or the menu is not ours yet
        }
        const tsNow = tsPicked.dataset.forkSort === "mtime" ? "mtime" : "created_at";
        if (tsNow !== tsWhich) {
            tsWhich = tsNow;
            tsWriteStored(tsWhich);
        }
        return tsWhich;
    };
    tsSelect.addEventListener("change", tsSync);

    const tsBuildSearchParams = tsPanel.tsBuildSearchParams;
    tsPanel.tsBuildSearchParams = function tsForkSortBuildSearchParams(...tsArgs) {
        const tsParams = tsBuildSearchParams.apply(this, tsArgs);
        if (tsSync() === "mtime" && !this.tsIsWorkflowSection?.()
            && tsParams?.get?.("sort") === "created_at" && tsArgs[1]?.sortKey === undefined) {
            tsParams.set("sort", "mtime");
        }
        return tsParams;
    };

    if (tsSelect.options.length) {
        tsPanel.tsRenderSortOptions();
    }
}
