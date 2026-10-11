// obvpm fork: each root (Output, Input, All) keeps its own view settings.
//
// Remembered per root: the type chips, Flat / Tree, Recurse, the sort order
// (key, direction, Modified or Created), Favorites, and the filters (values
// and whether the filter row is open). Switching roots puts the settings of
// the root being left aside and brings back those of the root being entered;
// a root seen for the first time starts from the settings it was entered
// with.
//
// The root currently shown needs no copy here: the panel saves its settings
// to the pack's settings file as always, and restores them on load. Only the
// roots set aside are kept, in this browser's localStorage (the settings file
// accepts a fixed list of keys).
//
// Hooked on the root dropdown's `change`, in the capture phase on its group:
// that runs before the panel's own handler, which then switches the root,
// saves and fetches with the restored settings. The Input / Output buttons
// fire that same event, so they are covered too.

const TS_FORK_ROOT_MEMORY_KEY = "tsab.fork.rootSettings";
const TS_FORK_TYPES = ["image", "video", "audio", "3d"];
const TS_FORK_SORT_KEYS = ["created_at", "filename", "size_bytes"];
const TS_FORK_FILTER_FIELDS = [
    ["tsFilterDateFrom", "string"],
    ["tsFilterDateTo", "string"],
    ["tsFilterMinWidth", "number"],
    ["tsFilterMaxWidth", "number"],
    ["tsFilterMinHeight", "number"],
    ["tsFilterMaxHeight", "number"],
];

function tsReadStored() {
    try {
        const tsParsed = JSON.parse(window.localStorage?.getItem(TS_FORK_ROOT_MEMORY_KEY) || "{}");
        return tsParsed && typeof tsParsed === "object" && !Array.isArray(tsParsed) ? tsParsed : {};
    } catch (tsError) {
        return {};
    }
}

function tsWriteStored(tsMemory) {
    try {
        window.localStorage?.setItem(TS_FORK_ROOT_MEMORY_KEY, JSON.stringify(tsMemory));
    } catch (tsError) {
        // not persisted; the memory still holds until the page reloads
    }
}

function tsTakeSnapshot(tsPanel) {
    const tsState = tsPanel.tsState;
    const tsRefs = tsPanel.tsRefs;
    const tsFilters = {};
    for (const [tsField] of TS_FORK_FILTER_FIELDS) {
        tsFilters[tsField] = tsState[tsField];
    }
    return {
        types: [...tsState.tsTypes],
        mode: tsState.tsMode,
        recurse: tsRefs.tsForkRecurseValue?.get(),
        sortKey: tsState.tsSortKey,
        sortDirection: tsState.tsSortDirection,
        sortDate: tsRefs.tsForkSortDateValue?.get(),
        favoritesOnly: Boolean(tsState.tsFavoritesOnly),
        filters: tsFilters,
        filtersOpen: Boolean(tsState.tsFiltersOpen),
    };
}

// Every value is checked before it reaches the panel: the storage is the
// browser's, and an older or hand-edited entry must not break the listing.
function tsApplySnapshot(tsPanel, tsSnap) {
    const tsState = tsPanel.tsState;
    const tsRefs = tsPanel.tsRefs;
    const tsHide3D = Boolean(tsRefs.tsForkHide3DValue?.get());
    if (Array.isArray(tsSnap.types)) {
        tsState.tsTypes = new Set(tsSnap.types.filter((tsType) => TS_FORK_TYPES.includes(tsType)
            && !(tsHide3D && tsType === "3d")));
    }
    if (tsSnap.mode === "flat" || tsSnap.mode === "tree") {
        tsState.tsMode = tsSnap.mode;
    }
    if (TS_FORK_SORT_KEYS.includes(tsSnap.sortKey)) {
        tsState.tsSortKey = tsSnap.sortKey;
    }
    if (tsSnap.sortDirection === "asc" || tsSnap.sortDirection === "desc") {
        tsState.tsSortDirection = tsSnap.sortDirection;
    }
    // the panel keeps a per-section copy of mode and sort: update it too
    tsPanel.tsSyncSectionSettingsFromActive?.();
    if (typeof tsSnap.favoritesOnly === "boolean") {
        tsState.tsFavoritesOnly = tsSnap.favoritesOnly;
    }
    const tsFilters = tsSnap.filters && typeof tsSnap.filters === "object" ? tsSnap.filters : {};
    for (const [tsField, tsKind] of TS_FORK_FILTER_FIELDS) {
        if (!(tsField in tsFilters)) {
            continue;
        }
        tsState[tsField] = tsKind === "number"
            ? Math.max(0, Math.floor(Number(tsFilters[tsField]) || 0))
            : String(tsFilters[tsField] || "");
    }
    if (typeof tsSnap.filtersOpen === "boolean") {
        tsState.tsFiltersOpen = tsSnap.filtersOpen || Boolean(tsPanel.tsHasActiveFilters?.());
    }
    if (typeof tsSnap.recurse === "boolean") {
        tsRefs.tsForkRecurseValue?.set(tsSnap.recurse);
    }
    if (tsSnap.sortDate === "mtime" || tsSnap.sortDate === "created_at") {
        tsRefs.tsForkSortDateValue?.set(tsSnap.sortDate);     // repaints the sort menu too
    }

    // Repaint every control that shows one of them. The fetch follows in
    // the panel's own root handler.
    tsPanel.tsRenderTypeChips?.();
    tsPanel.tsRenderModeButtons?.();
    tsPanel.tsRenderSortOptions?.();
    tsPanel.tsRenderSortDirection?.();
    tsPanel.tsRenderFavoritesToggle?.();
    tsPanel.tsSyncFilterInputs?.();
    tsPanel.tsRenderFilterPanel?.();
    // the filter row may have opened or closed: re-measure the toolbar
    tsPanel.tsLastObservedToolbarHeight = 0;
    tsPanel.tsApplyToolbarScale?.();
}

export function tsInstallForkRootMemory(tsPanel) {
    const tsRefs = tsPanel?.tsRefs;
    const tsGroup = tsRefs?.tsRootGroup;
    const tsSelect = tsRefs?.tsRootSelect;
    if (!tsGroup || !tsSelect || tsRefs.tsForkRootMemory) {
        return;
    }
    const tsMemory = tsReadStored();

    tsGroup.addEventListener("change", (tsEvent) => {
        if (tsEvent.target !== tsSelect || tsPanel.tsIsWorkflowSection?.()) {
            return;
        }
        const tsFrom = String(tsPanel.tsState?.tsRootId || "");
        const tsTo = String(tsSelect.value || "all");
        if (!tsFrom || tsFrom === tsTo) {
            return;
        }
        try {
            tsMemory[tsFrom] = tsTakeSnapshot(tsPanel);
            const tsSnap = tsMemory[tsTo];
            if (tsSnap && typeof tsSnap === "object") {
                tsApplySnapshot(tsPanel, tsSnap);
            }
            tsWriteStored(tsMemory);
        } catch (tsError) {
            // the root still switches, with the settings it had
            console.warn("Artius Browser (obvpm fork): root settings not restored", tsError);
        }
    }, true);

    tsRefs.tsForkRootMemory = true;
}
