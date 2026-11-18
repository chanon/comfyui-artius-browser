// obvpm fork: a "go to its folder" button (↔) on every thumbnail, to the right
// of the star. A click opens the file's own folder in Tree view and selects the
// file there, scrolled into view: from a search, a Multiple list or a Flat
// listing straight to the clips next to it.
//
// What a click does:
//   - the file's root (Input / Output) is entered through the root dropdown's
//     own `change`, so the fork's per-root memory sets aside and brings back
//     the roots' settings as for a click on Input / Output;
//   - Flat becomes Tree, the folder is selected and opened in the tree (its
//     parents expanded) and the tree scrolls to it;
//   - the search text and the Multiple list are cleared: either would hide the
//     folder's other files (filters, types and Favorites stay as set);
//   - once listed, the file is selected and the grid scrolls to it (pages not
//     shown yet are loaded first, up to TS_FORK_GOTO_MAX_ITEMS files).
//
// The panel is hooked on the INSTANCE, its file is not edited:
//   - tsBuildCardMediaMarkup: the button rides inside the media box, like the
//     star (assets only; workflows have no folders of this kind).
//   - tsHandleGalleryClick / tsHandleGalleryDoubleClick: the click on the
//     button; a double click on it does not open the viewer.

const TS_FORK_GOTO_MAX_ITEMS = 2000;

const TS_FORK_GOTO_CSS = `
    /* Right of the star (.ts-card-favorite), the same size and look; shown on
       hover or when the card is selected, as the star is. */
    .ts-fork-card-goto {
        position: absolute;
        top: var(--ts-card-inset, 8px);
        left: calc(var(--ts-card-inset, 8px) + var(--ts-card-action-size, 22px) + 4px);
        min-height: var(--ts-card-action-size, 22px);
        width: var(--ts-card-action-size, 22px);
        padding: 0;
        border: 0;
        border-radius: 999px;
        background: var(--ts-surface-overlay-strong);
        color: color-mix(in srgb, var(--ts-text) 55%, transparent);
        font-size: calc(var(--ts-card-action-font-size, 10px) + 2px);
        line-height: 1;
        opacity: 0;
        cursor: pointer;
        transition: opacity 0.14s ease, color 0.14s ease, transform 0.06s ease;
        z-index: 2;
    }
    .ts-card:hover .ts-fork-card-goto,
    .ts-card[data-selected="true"] .ts-fork-card-goto {
        opacity: 1;
    }
    .ts-fork-card-goto:hover {
        color: var(--ts-accent);
    }
    .ts-fork-card-goto:active {
        transform: scale(0.92);
    }
    .ts-fork-card-goto:focus-visible {
        outline: 2px solid var(--ts-accent);
        outline-offset: 1px;
        opacity: 1;
    }
`;

function tsCleanFolder(tsValue) {
    return String(tsValue || "").replace(/\\/g, "/").split("/").filter(Boolean).join("/");
}

export function tsInstallForkGotoFolder(tsPanel) {
    const tsRefs = tsPanel?.tsRefs;
    if (!tsRefs?.tsGalleryContent || typeof tsPanel.tsBuildCardMediaMarkup !== "function" || tsRefs.tsForkGotoFolder) {
        return;
    }
    const tsState = tsPanel.tsState;
    const tsT = (tsKey, tsFallback) => tsPanel.tsT?.(tsKey, tsFallback) || tsFallback;

    const tsStyle = document.createElement("style");
    tsStyle.textContent = TS_FORK_GOTO_CSS;
    tsPanel.shadowRoot?.append(tsStyle);

    // ---- the button ----
    const tsBuildCardMediaMarkup = tsPanel.tsBuildCardMediaMarkup;
    tsPanel.tsBuildCardMediaMarkup = function tsForkGotoCardMediaMarkup(tsItem, ...tsRest) {
        const tsMarkup = tsBuildCardMediaMarkup.call(this, tsItem, ...tsRest);
        if (this.tsIsWorkflowSection?.() || !tsItem?.root_id) {
            return tsMarkup;
        }
        const tsFolder = tsCleanFolder(tsItem.folder_path);
        const tsWhere = [tsItem.root_label || tsItem.root_id, tsFolder].filter(Boolean).join(" / ");
        const tsLabel = `${tsT("fork.gotoFolder", "Go to its folder")}: ${tsWhere}`;
        return `${tsMarkup}<button class="ts-fork-card-goto" type="button" data-action="fork-goto-folder"`
            + ` data-card-id="${tsItem.id}" title="${this.tsEscapeAttribute(tsLabel)}"`
            + ` aria-label="${this.tsEscapeAttribute(tsLabel)}">↔︎</button>`;
    };

    // ---- the jump ----
    const tsWaitForListing = async () => {
        let tsGuard = 0;
        while ((tsState.tsLoading || tsState.tsQueuedFetchReset) && tsGuard < 400) {
            tsGuard += 1;
            await (tsState.tsLoading && tsPanel.tsCurrentFetchPromise
                ? tsPanel.tsCurrentFetchPromise.catch(() => {})
                : new Promise((tsResolve) => setTimeout(tsResolve, 25)));
        }
    };

    let tsJumping = false;
    const tsGoToFolder = async (tsItem) => {
        const tsRootId = String(tsItem?.root_id || "");
        if (!tsRootId || tsJumping) {
            return;
        }
        tsJumping = true;
        try {
            const tsFolder = tsCleanFolder(tsItem.folder_path);
            // Another root: through the dropdown's own change (per-root memory, then
            // the panel's switch). It fetches; the fetch below queues behind it.
            const tsSelect = tsRefs.tsRootSelect;
            if (tsState.tsRootId !== tsRootId && tsSelect
                && [...tsSelect.options].some((tsOption) => tsOption.value === tsRootId)) {
                tsSelect.value = tsRootId;
                tsSelect.dispatchEvent(new Event("change", { bubbles: true }));
            }
            tsState.tsRootId = tsRootId;

            // Nothing may hide the folder's other files: no search, no Multiple list.
            // Set quietly (no input event): a debounced search would run after the jump.
            tsState.tsSearch = "";
            if (tsRefs.tsSearch) {
                tsRefs.tsSearch.value = "";
            }
            tsRefs.tsForkMultipleClearQuietly?.();

            if (tsState.tsMode !== "tree") {
                tsState.tsMode = "tree";
                tsPanel.tsRenderModeButtons?.();
            }
            tsState.tsFolder = tsFolder;
            tsPanel.tsSyncSectionSettingsFromActive?.();
            // open the folder's branch in the tree
            tsState.tsExpandedFolders.add(`root:${tsRootId}`);
            let tsPath = "";
            for (const tsPart of tsFolder.split("/").filter(Boolean).slice(0, -1)) {
                tsPath = tsPath ? `${tsPath}/${tsPart}` : tsPart;
                tsState.tsExpandedFolders.add(`${tsRootId}:${tsPath}`);
            }
            tsPanel.tsRememberAssetLocation?.();
            tsPanel.tsRenderSearchHint?.();
            tsPanel.tsQueueSaveUISettings?.();

            await tsPanel.tsFetchAssets(true);
            await tsWaitForListing();
            tsRefs.tsTreePanel?.querySelector('.ts-tree-folder[data-active="true"]')?.scrollIntoView?.({ block: "nearest" });

            // the file: on a page not shown yet, load on until it is there
            let tsIndex = tsPanel.tsItemIndexById?.get(tsItem.id);
            let tsGuard = 0;
            while (tsIndex === undefined && tsState.tsHasMore && (tsState.tsItems || []).length < TS_FORK_GOTO_MAX_ITEMS && tsGuard < 100) {
                tsGuard += 1;
                const tsBefore = tsState.tsItems.length;
                await tsPanel.tsFetchAssets(false);
                await tsWaitForListing();
                if (tsState.tsItems.length === tsBefore) {
                    break;
                }
                tsIndex = tsPanel.tsItemIndexById?.get(tsItem.id);
            }
            if (tsIndex === undefined) {
                return;     // hidden by a filter, a type or Favorites: the folder is shown all the same
            }
            tsPanel.tsClearSelection?.();
            tsState.tsSelection.add(tsItem.id);
            tsState.tsSelectionAnchorId = tsItem.id;
            tsState.tsLastSelectedIndex = tsIndex;
            tsPanel.tsRenderSelectionButtons?.();
            tsPanel.tsRefreshCardSelection?.();
            tsPanel.tsEnsureIndexVisible?.(tsIndex);
        } finally {
            tsJumping = false;
        }
    };

    const tsHandleGalleryClick = tsPanel.tsHandleGalleryClick;
    tsPanel.tsHandleGalleryClick = function tsForkGotoGalleryClick(tsEvent, ...tsRest) {
        const tsButton = tsEvent?.target?.closest?.('[data-action="fork-goto-folder"]');
        if (!tsButton) {
            return tsHandleGalleryClick.call(this, tsEvent, ...tsRest);
        }
        const tsItem = this.tsFindItemById(Number(tsButton.dataset.cardId));
        if (tsItem) {
            void tsGoToFolder(tsItem);
        }
        return undefined;
    };

    const tsHandleGalleryDoubleClick = tsPanel.tsHandleGalleryDoubleClick;
    tsPanel.tsHandleGalleryDoubleClick = function tsForkGotoGalleryDoubleClick(tsEvent, ...tsRest) {
        if (tsEvent?.target?.closest?.('[data-action="fork-goto-folder"]')) {
            tsEvent.preventDefault();
            tsEvent.stopPropagation();
            return undefined;
        }
        return tsHandleGalleryDoubleClick.call(this, tsEvent, ...tsRest);
    };

    tsRefs.tsForkGotoFolder = tsGoToFolder;
}
