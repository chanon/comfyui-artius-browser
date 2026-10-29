// obvpm fork: Compare, Download and Delete live in a bar docked along the
// bottom of the whole panel, which is only there when they can be used.
//
// In the toolbar they sat, mostly disabled, beside controls clicked all the
// time -- Delete among them. Here:
//   - Compare shows once the selection can be compared (the panel's own rule:
//     two or more images, or two or more videos).
//   - Download (upstream's "Download Selected", one ZIP) and Delete show once
//     MORE THAN ONE item is selected. A single item already has both on the
//     card and in the context menu (and Delete on the Delete key).
//   - the bar shows when any does, with the count and a way to deselect.
//
// As with the settings popup the buttons are MOVED, not rebuilt: the same
// elements, so the panel's listeners, tooltips and disabling keep working.
// The panel is hooked through its own methods, wrapped on the INSTANCE -- its
// file is not edited for this:
//   - tsRenderSelectionButtons: the panel calls it on every selection change,
//     so the bar follows the selection by following that call.
//   - tsHydrateText: the labels lose their "Selected" (the bar says it).
// Upstream confirms a batch delete itself since 1.20.0; the confirm feature
// puts that question in ComfyUI's own dialog.

export function tsInstallForkSelectionBar(tsPanel) {
    const tsRefs = tsPanel?.tsRefs;
    const tsCompare = tsRefs?.tsCompareSelected;
    const tsDownload = tsRefs?.tsDownloadSelected;     // upstream 1.20.1
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
    // count and its clear on the left with Compare and Download; Delete alone
    // at the far right, away from everything that is clicked casually
    tsBar.append(...[tsCount, tsClear, tsCompare, tsDownload, tsDelete].filter(Boolean));   // append MOVES them
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
        const tsShowDownload = Boolean(tsDownload) && !tsWorkflows && tsItems.length > 1;
        tsBar.dataset.compare = String(tsShowCompare);
        tsBar.dataset.download = String(tsShowDownload);
        tsBar.dataset.delete = String(tsShowDelete);
        tsBar.hidden = !(tsShowCompare || tsShowDownload || tsShowDelete);
        tsCount.textContent = tsT("fork.selected", "{count} selected")
            .replace("{count}", String(tsItems.length));
        tsRelabel();
        const tsClearLabel = tsT("fork.clearSelection", "Clear selection");
        tsClear.title = tsClearLabel;
        tsClear.setAttribute("aria-label", tsClearLabel);
    };

    // In a bar that only exists for a selection, "Selected" and the count say
    // nothing (the bar shows the count). The panel rewrites the labels when it
    // (re)hydrates its text and -- since 1.20.0 -- on every selection change
    // ("Delete Selected (3)"), so both calls are followed; "menu.delete" and
    // "button.download" are the panel's own, already translated, words. The
    // Download button keeps upstream's "Packing..." while a ZIP is made.
    const tsRelabel = () => {
        const tsDeleteText = tsT("menu.delete", "Delete");
        if (tsDelete.textContent !== tsDeleteText) {
            tsDelete.textContent = tsDeleteText;
        }
        if (tsDownload && !tsPanel.tsArchiveBusy) {
            const tsDownloadText = tsT("button.download", "Download");
            if (tsDownload.textContent !== tsDownloadText) {
                tsDownload.textContent = tsDownloadText;
            }
        }
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
