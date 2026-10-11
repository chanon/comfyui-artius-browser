// obvpm fork: the toolbar row in the order it is used, and a shorter label.
//
// Order: what you are looking at comes first -- the root (Output / Input),
// the type chips (Image Video Audio 3D), Flat / Tree -- then how it is
// narrowed, the thumbnail size slider and Rescan, and the search field last,
// where it takes whatever width the row has left.
//
// The elements are re-ordered in the DOM rather than with CSS `order`, so the
// Tab key walks them in the order they are seen. Anything these lists do not
// know (a control upstream adds later) keeps its place before the search.

const TS_FORK_TOOLBAR_ORDER = [
    ".ts-section-group",        // Assets / Workflows -- hidden by "Only show Assets"
    ".ts-root-group",           // Output / Input / All
    ".ts-type-cluster",         // Image Video Audio 3D
    ".ts-mode-group",           // Flat / Tree
    ".ts-sort-group",
    ".ts-favorites-toggle",
    ".ts-filters-toggle",
];
// After everything else, in this order: the search field is the last control.
const TS_FORK_TOOLBAR_LAST = [".ts-preview-size", ".ts-rescan", ".ts-search-cluster"];

// English labels the fork shortens. Matched on the VALUE the active locale
// gives, so a translation is left alone and only the English text changes.
const TS_FORK_LABELS = {
    "label.allRoots": ["All Folders", "All"],
};

export function tsInstallForkToolbar(tsPanel) {
    const tsRefs = tsPanel?.tsRefs;
    const tsRow = tsRefs?.tsToolbarMain;
    if (!tsRow || tsRefs.tsForkToolbar) {
        return;
    }
    const tsDirect = (tsSelector) => [...tsRow.children]
        .find((tsChild) => tsChild.matches?.(tsSelector));

    let tsCursor = null;        // the last element placed
    for (const tsSelector of TS_FORK_TOOLBAR_ORDER) {
        const tsElement = tsDirect(tsSelector);
        if (!tsElement) {
            continue;
        }
        const tsBefore = tsCursor ? tsCursor.nextSibling : tsRow.firstChild;
        if (tsBefore !== tsElement) {
            tsRow.insertBefore(tsElement, tsBefore);
        }
        tsCursor = tsElement;
    }
    for (const tsSelector of TS_FORK_TOOLBAR_LAST) {
        const tsLast = tsDirect(tsSelector);
        if (tsLast) {
            tsRow.append(tsLast);
        }
    }

    const tsTranslate = tsPanel.tsT;
    if (typeof tsTranslate === "function") {
        tsPanel.tsT = function tsForkT(tsKey, tsFallback) {
            const tsText = tsTranslate.call(this, tsKey, tsFallback);
            const tsSwap = TS_FORK_LABELS[tsKey];
            return tsSwap && tsText === tsSwap[0] ? tsSwap[1] : tsText;
        };
    }
    tsRefs.tsForkToolbar = true;
}
