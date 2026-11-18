// obvpm fork: a new search keeps what is selected, so clips found by separate
// searches can be picked one after the other and compared. Only the search does
// this: a new folder, root, file type, filter, sort or section clears the
// selection, as upstream does.
//
// Upstream's selection is a set of ids that must be in the list on screen; its
// hard reset clears the set and its other paths drop ids they cannot find. So
// what a search takes off the list is "held" here, with its item, while its id
// stays in the set, and the set's order stays the order of the clicks. The first
// clip picked is the first in a comparison.
//
// The panel is hooked on the INSTANCE, its file is not edited:
//   - tsDebouncedSearch and the Prompt toggle: mark the next hard reset as a search.
//   - tsFetchAssets: takes the snapshot when that reset really starts (a fetch
//     already running only queues it, and the queued call comes back through here).
//   - tsRebuildItemIndex: every list change passes it, after the reset's clear and
//     before the render, so the cards never draw without their selection.
//   - tsApplyPreservedSelection: would drop the held ids on a background refresh.
//   - tsGetSelectedItems: everything that acts on the selection reads it, so
//     Compare, Download and the bar see the held clips too.
//   - tsOpenViewer: upstream's looks in the list only, and compares in the
//     grid's order. With held clips, or a Multiple list (fork-multiple sets
//     tsRefs.tsForkCompareInSelectionOrder), the comparison follows the selection.
//   - tsRemoveItemsByIds: upstream's returns early for what is not on the list.
//
// A plain click, Esc, the bar's x and a click on the empty grid clear everything,
// held clips included: they go through upstream's own clear, and a held id no
// longer in the set is forgotten here. The bar says how many are held and names
// them, and deleting one always asks and names it (fork-confirm).

const TS_FORK_COMPARE_MAX = 6;   // = TS_COMPARE_MAX_ITEMS (viewer-state)

export function tsInstallForkKeepSelection(tsPanel) {
    const tsRefs = tsPanel?.tsRefs;
    if (!tsRefs || tsRefs.tsForkHeldSelection) {
        return;
    }
    const tsHeld = new Map();       // id -> item, selected but not on the list
    let tsKeepNext = false;
    let tsPending = null;

    const tsSelection = () => tsPanel.tsState.tsSelection;
    const tsSettle = () => {
        for (const tsId of [...tsHeld.keys()]) {
            if (!tsSelection().has(tsId) || tsPanel.tsItemIndexById.has(tsId)) {
                tsHeld.delete(tsId);
            }
        }
    };
    tsRefs.tsForkHeldSelection = () => {
        tsSettle();
        return [...tsHeld.values()];
    };

    const tsDebouncedSearch = tsPanel.tsDebouncedSearch;
    tsPanel.tsDebouncedSearch = function tsForkDebouncedSearch(...tsArgs) {
        tsKeepNext = !this.tsIsWorkflowSection();
        return tsDebouncedSearch.apply(this, tsArgs);
    };
    // before upstream's listener, which fetches at once when a search is typed
    tsRefs.tsSearchScope?.addEventListener("click", () => {
        if (String(tsPanel.tsState.tsSearch || "").trim() && !tsPanel.tsIsWorkflowSection()) {
            tsKeepNext = true;
        }
    }, { capture: true });

    const tsFetchAssets = tsPanel.tsFetchAssets;
    tsPanel.tsFetchAssets = function tsForkFetchAssets(tsReset = true, tsOptions = {}) {
        if (tsReset && !this.tsState.tsLoading) {
            // upstream: a refresh over an empty list is a hard reset too, and a
            // search that found nothing must not lose the clips because of it
            const tsWantsPreserve = Boolean(tsOptions?.tsPreserveView);
            const tsIsHard = !tsWantsPreserve || this.tsState.tsItems.length === 0;
            if (tsIsHard && (tsKeepNext || (tsWantsPreserve && tsHeld.size > 0))) {
                tsKeepNext = false;
                tsPending = this.tsGetSelectedItems();
            }
        }
        return tsFetchAssets.call(this, tsReset, tsOptions);
    };

    const tsRebuildItemIndex = tsPanel.tsRebuildItemIndex;
    tsPanel.tsRebuildItemIndex = function tsForkRebuildItemIndex(...tsArgs) {
        const tsResult = tsRebuildItemIndex.apply(this, tsArgs);
        if (tsPending) {
            for (const tsItem of tsPending) {
                tsSelection().add(tsItem.id);
                if (!this.tsItemIndexById.has(tsItem.id)) {
                    tsHeld.set(tsItem.id, tsItem);
                }
            }
            tsPending = null;
        }
        tsSettle();
        return tsResult;
    };

    const tsApplyPreservedSelection = tsPanel.tsApplyPreservedSelection;
    tsPanel.tsApplyPreservedSelection = function tsForkApplyPreservedSelection(...tsArgs) {
        const tsBefore = [...tsSelection()];
        const tsResult = tsApplyPreservedSelection.apply(this, tsArgs);
        if (tsHeld.size > 0) {
            // cleared and filled again: adding the held ones back alone would
            // put them after the others, and change the order of a comparison
            tsSelection().clear();
            for (const tsId of tsBefore) {
                if (this.tsItemIndexById.has(tsId) || tsHeld.has(tsId)) {
                    tsSelection().add(tsId);
                }
            }
        }
        return tsResult;
    };

    tsPanel.tsGetSelectedItems = function tsForkGetSelectedItems() {
        tsSettle();
        const tsItems = [];
        for (const tsId of tsSelection()) {
            const tsItem = this.tsFindItemById(tsId) || tsHeld.get(tsId);
            if (tsItem) {
                tsItems.push(tsItem);
            }
        }
        return tsItems;
    };

    const tsOpenViewer = tsPanel.tsOpenViewer;
    tsPanel.tsOpenViewer = function tsForkOpenViewer(tsAssetId, ...tsRest) {
        tsSettle();
        const tsInOrder = tsHeld.size > 0 || Boolean(tsRefs.tsForkCompareInSelectionOrder?.());
        if (tsInOrder && tsSelection().has(tsAssetId)) {
            const tsSelected = this.tsGetSelectedItems();
            const tsType = tsSelected.find((tsItem) => tsItem.id === tsAssetId)?.type;
            const tsCompare = (tsType === "image" || tsType === "video")
                ? tsSelected.filter((tsItem) => tsItem.type === tsType).slice(0, TS_FORK_COMPARE_MAX)
                : [];
            const tsIndex = tsCompare.findIndex((tsItem) => tsItem.id === tsAssetId);
            if (tsCompare.length >= 2 && tsIndex >= 0) {
                this.tsViewer?.tsOpen(tsCompare, tsIndex, () => {}, {
                    tsCompareItems: tsCompare,
                    tsOnDeleted: (tsIds) => this.tsRemoveItemsByIds(tsIds),
                });
                return undefined;
            }
        }
        return tsOpenViewer.call(this, tsAssetId, ...tsRest);
    };

    const tsRemoveItemsByIds = tsPanel.tsRemoveItemsByIds;
    tsPanel.tsRemoveItemsByIds = function tsForkRemoveItemsByIds(tsIds, ...tsRest) {
        let tsWasHeld = false;
        for (const tsId of (Array.isArray(tsIds) ? tsIds : []).map(Number)) {
            if (tsHeld.delete(tsId)) {
                tsSelection().delete(tsId);
                tsWasHeld = true;
            }
        }
        const tsResult = tsRemoveItemsByIds.call(this, tsIds, ...tsRest);
        if (tsWasHeld) {
            this.tsRenderSelectionButtons();
        }
        return tsResult;
    };
}
