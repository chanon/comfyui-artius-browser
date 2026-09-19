// obvpm fork: Compare and Delete live in a bar docked along the bottom of
// the whole panel, which is only there when they can be used.
//
// In the toolbar they sat, mostly disabled, beside controls clicked all the
// time -- Delete among them. Here:
//   - Compare shows once the selection can be compared (the panel's own rule:
//     two or more images, or two or more videos).
//   - Delete shows once MORE THAN ONE item is selected. A single item already
//     has its delete on the card, in the context menu and on the Delete key.
//   - the bar shows when either does, with the count and a way to deselect.
//
// As with the settings popup the two buttons are MOVED, not rebuilt: the same
// elements, so the panel's listeners, labels ("Compare (3)"), tooltips and
// disabling keep working. The panel is hooked through two of its own methods,
// wrapped on the INSTANCE -- its file is not edited for this:
//   - tsRenderSelectionButtons: the panel calls it on every selection change,
//     so the bar follows the selection by following that call.
//   - tsDeleteAssets: the one door every delete goes through (this bar, the
//     Delete key, the context menu), so the confirmation sits there.

export function tsInstallForkSelectionBar(tsPanel) {
    const tsRefs = tsPanel?.tsRefs;
    const tsCompare = tsRefs?.tsCompareSelected;
    const tsDelete = tsRefs?.tsDeleteSelected;
    const tsShell = tsRefs?.tsShell;
    if (!tsCompare || !tsDelete || !tsShell || tsRefs.tsForkSelectionBar) {
        return;
    }
    const tsT = (tsKey, tsFallback) => tsPanel.tsT?.(tsKey, tsFallback) || tsFallback;

    const tsBar = document.createElement("div");
    tsBar.className = "ts-fork-selbar";
    tsBar.hidden = true;
    tsBar.setAttribute("role", "toolbar");
    const tsCount = document.createElement("span");
    tsCount.className = "ts-fork-selbar-count";
    const tsClear = document.createElement("button");
    tsClear.type = "button";
    tsClear.className = "ts-fork-selbar-clear";
    tsClear.textContent = "×";
    // count and its clear on the left with Compare; Delete alone at the far
    // right, away from everything that is clicked casually
    tsBar.append(tsCount, tsClear, tsCompare, tsDelete);   // append MOVES the two
    // A row of the shell's own grid (toolbar / body / this), right after the
    // body: full width, under the tree and the gallery alike. Hidden it takes
    // no row at all, and the gallery gets its height back.
    const tsBody = tsRefs.tsGalleryScroll?.closest?.(".ts-body");
    if (tsBody?.parentNode === tsShell) {
        tsBody.after(tsBar);
    } else {
        tsShell.append(tsBar);
    }

    const tsUpdate = () => {
        const tsItems = tsPanel.tsGetSelectedItems?.() || [];
        const tsWorkflows = Boolean(tsPanel.tsIsWorkflowSection?.());
        const tsDeletable = tsItems.filter((tsItem) => tsItem?.allow_delete).length;
        // the panel has just decided whether the selection can be compared
        const tsShowCompare = !tsWorkflows && !tsCompare.disabled;
        const tsShowDelete = !tsWorkflows && tsItems.length > 1 && tsDeletable > 0;
        tsBar.dataset.compare = String(tsShowCompare);
        tsBar.dataset.delete = String(tsShowDelete);
        tsBar.hidden = !(tsShowCompare || tsShowDelete);
        tsCount.textContent = tsT("fork.selected", "{count} selected")
            .replace("{count}", String(tsItems.length));
        const tsClearLabel = tsT("fork.clearSelection", "Clear selection");
        tsClear.title = tsClearLabel;
        tsClear.setAttribute("aria-label", tsClearLabel);
    };

    // In a bar that only exists for a selection, "Selected" says nothing. The
    // panel rewrites the label whenever it (re)hydrates its text, so follow
    // that call; "menu.delete" is the panel's own, already translated, word.
    const tsRelabel = () => {
        tsDelete.textContent = tsT("menu.delete", "Delete");
    };
    const tsHydrateText = tsPanel.tsHydrateText;
    if (typeof tsHydrateText === "function") {
        tsPanel.tsHydrateText = function tsForkHydrateText(...tsArgs) {
            const tsResult = tsHydrateText.apply(this, tsArgs);
            tsRelabel();
            return tsResult;
        };
    }
    tsRelabel();

    const tsRenderSelectionButtons = tsPanel.tsRenderSelectionButtons;
    tsPanel.tsRenderSelectionButtons = function tsForkRenderSelectionButtons(...tsArgs) {
        const tsResult = tsRenderSelectionButtons.apply(this, tsArgs);
        tsUpdate();
        return tsResult;
    };

    // More than one file leaves at once -> ask first. One file stays as
    // immediate as upstream made it (it goes to the system trash either way).
    const tsDeleteAssets = tsPanel.tsDeleteAssets;
    tsPanel.tsDeleteAssets = function tsForkDeleteAssets(tsAssets, ...tsRest) {
        const tsList = Array.isArray(tsAssets) ? tsAssets : [];
        const tsDeletable = tsList.filter((tsAsset) => tsAsset?.allow_delete).length;
        if (tsDeletable > 1) {
            let tsMessage = tsT("fork.confirmDelete", "Send {count} selected assets to the system trash?")
                .replace("{count}", String(tsDeletable));
            const tsKept = tsList.length - tsDeletable;
            if (tsKept > 0) {
                tsMessage += "\n\n" + tsT("fork.confirmDeleteKept",
                    "{count} more cannot be deleted from here and will be kept.")
                    .replace("{count}", String(tsKept));
            }
            if (!window.confirm(tsMessage)) {
                return undefined;
            }
        }
        return tsDeleteAssets.call(this, tsAssets, ...tsRest);
    };

    tsClear.addEventListener("click", () => {
        tsPanel.tsState?.tsSelection?.clear?.();
        if (tsPanel.tsState) {
            tsPanel.tsState.tsLastSelectedIndex = -1;
        }
        tsPanel.tsRenderSelectionButtons();
        tsPanel.tsRefreshCardSelection?.();
    });

    tsRefs.tsForkSelectionBar = tsBar;
    // Through the panel's own render, not tsUpdate alone: the bar reads the
    // Compare button's `disabled`, and until the panel has rendered once that
    // still says "enabled" -- the bar would flash up over an empty selection.
    try {
        tsPanel.tsRenderSelectionButtons();
    } catch (tsError) {
        tsUpdate();
    }
}
