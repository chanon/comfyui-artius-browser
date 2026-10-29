// obvpm fork: narrower toolbar controls -- the sort menus (Modified/Created,
// Desc/Asc) and the Flat / Tree dropdown take less padding, the thumbnail
// size slider is shorter and the search field gives up its place on the
// first row later. The sizes themselves are a CSS block at the end of the
// stylesheet ("narrower toolbar controls").
//
// The panel sizes each dropdown to its current text from JavaScript
// (tsResizeSelectToCurrent: text + 32 px, for upstream's 10 px left padding,
// 20 px arrow zone and 2 px of room), so the narrower padding alone would
// leave the same width. The method is wrapped on the INSTANCE, the panel
// file is not edited: after the panel's own sizing, these dropdowns give
// back what their CSS no longer pads.

// upstream's 10 + 20 against the fork's 5 + 15 (TS_FORK_NARROW_* in the CSS)
const TS_FORK_NARROW_SAVED_PX = 10;
const TS_FORK_NARROW_SELECTS = ".ts-sort-group select, select.ts-fork-mode-select";

export function tsInstallForkNarrowToolbar(tsPanel) {
    const tsOriginal = tsPanel?.tsResizeSelectToCurrent;
    if (typeof tsOriginal !== "function" || tsPanel.tsForkNarrowToolbar) {
        return;
    }
    tsPanel.tsForkNarrowToolbar = true;
    tsPanel.tsResizeSelectToCurrent = function (tsSelect, ...tsRest) {
        const tsResult = tsOriginal.call(this, tsSelect, ...tsRest);
        const tsWidth = parseFloat(tsSelect?.style?.width || "");
        if (tsWidth > 0 && tsSelect.matches?.(TS_FORK_NARROW_SELECTS)) {
            tsSelect.style.width = `${Math.max(0, tsWidth - TS_FORK_NARROW_SAVED_PX)}px`;
        }
        return tsResult;
    };
    // the sort menus may already be sized (since upstream 1.20.0 the direction
    // is a button, not a dropdown: only dropdowns are sized)
    for (const tsSelect of [tsPanel.tsRefs?.tsSortSelect, tsPanel.tsRefs?.tsSortDirection]) {
        if (tsSelect?.tagName === "SELECT") {
            tsPanel.tsResizeSelectToCurrent(tsSelect);
        }
    }
}
