// obvpm fork: "Multiple" -- find many files at once by name, then select them
// all, for comparing a list of clips.
//
//   - A "Multiple" pill in the search field (where upstream's Prompt pill sat)
//     opens a row under the toolbar, like the Filters row, with a box for one
//     file name per line. The grid shows every file whose name contains ANY
//     line (sent as `names`; ts_routes.py / ts_db_query.py do the matching), as
//     you type. A pasted path keeps only its file name. The row says which
//     names were not found among the files listed.
//   - "Select all" in the row, or Ctrl+A anywhere in the panel outside a text
//     box, selects every file listed (loading the pages not shown yet first).
//     With a list, the selection follows the list's order, so Compare shows
//     the clips in the order they were pasted. "Compare" in the row does the
//     same, then opens the comparison (the first six of the list); so does
//     Ctrl+Enter in the box.
//   - Upstream's Prompt pill is hidden unless "Show Prompt search" is on in
//     the settings popup (off by default). Hidden, the search looks at
//     filenames only, and the empty grid offers Clear search instead of
//     switching to a prompt search that could not be seen or turned off.
//
// A list change counts as a search (tsDebouncedSearch), so the fork's
// keep-selection keeps what is selected while the list is edited.
//
// Kept in this browser's localStorage, like the fork's other options: the
// pack's settings file accepts a fixed list of keys.
//
// The panel is hooked on the INSTANCE, its file is not edited:
//   - tsBuildSearchParams: every asset request is built there.
//   - tsRenderToolbarForSection: shows / hides the pills and the row with the section.
//   - tsApplySearchScopeInset: the search field reserves room for the pills.
//   - tsBuildEmptyState / tsHandleEmptyStateClick: the empty grid's message.
//   - tsFetchAssets: the "not found" line follows each listing.

const TS_FORK_SHOW_PROMPT_KEY = "tsab.fork.showPrompt";
const TS_FORK_NAMES_KEY = "tsab.fork.multipleNames";
const TS_FORK_OPEN_KEY = "tsab.fork.multipleOpen";
const TS_FORK_MAX_NAMES = 300;          // the server keeps the same number
const TS_FORK_SELECT_ALL_CAP = 2000;    // Ctrl+A loads at most this many files

const TS_FORK_MULTIPLE_CSS = `
    .ts-fork-multiple-panel {
        flex-direction: column;
        align-items: stretch;
        gap: 6px;
    }
    .ts-fork-multiple-panel[data-open="false"] {
        display: none;
    }
    .ts-fork-multiple-names {
        width: 100%;
        min-height: 64px;
        height: 96px;
        resize: vertical;
        box-sizing: border-box;
        background: var(--ts-bg-2);
        color: var(--ts-text);
        border: 1px solid var(--ts-border);
        border-radius: 6px;
        padding: 5px 7px;
        font: 12px/1.45 inherit;
        font-family: inherit;
        white-space: pre;
        overflow-wrap: normal;
    }
    .ts-fork-multiple-names:focus {
        outline: none;
        border-color: var(--ts-accent);
    }
    .ts-fork-multiple-foot {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
    }
    .ts-fork-multiple-status {
        flex: 1 1 auto;
        min-width: 0;
        font-size: 11px;
        color: var(--ts-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .ts-fork-multiple-status[data-missing="true"] {
        color: var(--ts-warning, #e3b768);
    }
    .ts-fork-multiple-foot button {
        flex: none;
    }
    /* a list narrows the grid while the row is closed (as .ts-filters-toggle[data-applied]) */
    .ts-toolbar-cluster.ts-search-cluster .ts-search-scope.ts-fork-multiple[data-applied="true"]::after {
        content: "";
        width: 5px;
        height: 5px;
        flex: 0 0 5px;
        border-radius: 999px;
        background: var(--ts-accent);
    }
`;

function tsReadStored(tsKey, tsFallback) {
    try {
        const tsValue = window.localStorage?.getItem(tsKey);
        return tsValue === null || tsValue === undefined ? tsFallback : tsValue;
    } catch (tsError) {
        return tsFallback;
    }
}

function tsWriteStored(tsKey, tsValue) {
    try {
        window.localStorage?.setItem(tsKey, tsValue);
    } catch (tsError) {
        // not persisted; still works until the page reloads
    }
}

// The same reading of the box as the server's (ts_routes.TSParseForkNames).
export function tsForkParseNames(tsText) {
    const tsNames = [];
    for (const tsLine of String(tsText || "").split(/\r\n|\r|\n/)) {
        let tsName = tsLine.trim().replace(/^["']+|["']+$/g, "").trim();
        tsName = tsName.replace(/\\/g, "/").split("/").pop().trim().normalize("NFC");
        if (tsName && !tsNames.includes(tsName)) {
            tsNames.push(tsName);
        }
        if (tsNames.length >= TS_FORK_MAX_NAMES) {
            break;
        }
    }
    return tsNames;
}

// Whether a lower-cased filename contains a list line, "*" in the line standing
// for any text (the server's LIKE pattern, ts_db_query.TSForkSearchPattern).
// Each piece is taken at its first place after the previous one.
function tsForkLineMatches(tsLowerFilename, tsName) {
    let tsAt = 0;
    for (const tsPiece of tsName.toLowerCase().split("*")) {
        const tsFound = tsLowerFilename.indexOf(tsPiece, tsAt);
        if (tsFound < 0) {
            return false;
        }
        tsAt = tsFound + tsPiece.length;
    }
    return true;
}

// Index of the first list line a filename contains, or -1.
function tsForkLineIndex(tsNames, tsFilename) {
    const tsLower = String(tsFilename || "").normalize("NFC").toLowerCase();
    return tsNames.findIndex((tsName) => tsForkLineMatches(tsLower, tsName));
}

export function tsInstallForkMultiple(tsPanel) {
    const tsRefs = tsPanel?.tsRefs;
    const tsScope = tsRefs?.tsSearchScope;
    const tsCluster = tsScope?.parentElement;
    if (!tsCluster || !tsRefs.tsFilterPanel || tsRefs.tsForkMultiple) {
        return;
    }
    const tsT = (tsKey, tsFallback) => tsPanel.tsT?.(tsKey, tsFallback) || tsFallback;
    const tsState = tsPanel.tsState;

    const tsStyle = document.createElement("style");
    tsStyle.textContent = TS_FORK_MULTIPLE_CSS;
    tsPanel.shadowRoot?.append(tsStyle);

    let tsShowPrompt = tsReadStored(TS_FORK_SHOW_PROMPT_KEY, "0") === "1";
    let tsText = tsReadStored(TS_FORK_NAMES_KEY, "");
    let tsNames = tsForkParseNames(tsText);
    let tsOpen = tsReadStored(TS_FORK_OPEN_KEY, "0") === "1";

    // ---- the pill, in the search field where Prompt sat (same look: its classes) ----
    const tsPill = document.createElement("button");
    tsPill.type = "button";
    tsPill.className = "ts-toggle-button ts-search-scope ts-fork-multiple";
    tsCluster.append(tsPill);

    // ---- the row, under the Filters row ----
    const tsRow = document.createElement("div");
    tsRow.className = "ts-filter-panel ts-fork-multiple-panel";
    tsRow.dataset.open = "false";
    tsRow.hidden = true;
    const tsBox = document.createElement("textarea");
    tsBox.className = "ts-fork-multiple-names";
    tsBox.spellcheck = false;
    tsBox.value = tsText;
    const tsFoot = document.createElement("div");
    tsFoot.className = "ts-fork-multiple-foot";
    const tsStatus = document.createElement("span");
    tsStatus.className = "ts-fork-multiple-status";
    const tsCompareButton = document.createElement("button");
    tsCompareButton.type = "button";
    tsCompareButton.className = "ts-filter-clear ts-fork-multiple-compare";
    const tsSelectAllButton = document.createElement("button");
    tsSelectAllButton.type = "button";
    tsSelectAllButton.className = "ts-filter-clear ts-fork-multiple-select";
    const tsClearButton = document.createElement("button");
    tsClearButton.type = "button";
    tsClearButton.className = "ts-filter-clear ts-fork-multiple-clear";
    tsFoot.append(tsStatus, tsCompareButton, tsSelectAllButton, tsClearButton);
    tsRow.append(tsBox, tsFoot);
    tsRefs.tsFilterPanel.after(tsRow);

    const tsAssets = () => !tsPanel.tsIsWorkflowSection?.();
    const tsActive = () => tsAssets() && tsNames.length > 0;

    // ---- settings popup: Show Prompt search ----
    const tsPromptToggle = document.createElement("button");
    tsPromptToggle.type = "button";
    tsPromptToggle.className = "ts-toggle-button ts-fork-show-prompt";
    const tsPromptLabel = document.createElement("span");
    tsPromptToggle.append(tsPromptLabel);
    tsRefs.tsForkSettingsAddRow?.(tsPromptToggle, (tsTr) => {
        tsPromptLabel.textContent = tsTr("fork.showPrompt", "Show Prompt search");
        return tsTr("fork.showPromptHint", "The Prompt pill in the search field, which also searches prompts and model names. Off: the search looks at filenames only.");
    });

    // Hidden Prompt pill = filename search: a saved "all" would search prompts out of sight.
    const tsForceFilenameScope = () => {
        if (tsShowPrompt || tsState.tsSearchScope !== "all") {
            return false;
        }
        tsState.tsSearchScope = "filename";
        tsPanel.tsSetToggleState?.(tsScope, false);
        tsPanel.tsRenderSearchHint?.();
        tsPanel.tsQueueSaveUISettings?.();
        return true;
    };

    const tsPaintPills = () => {
        const tsAssetSection = tsAssets();
        const tsPromptShown = tsAssetSection && tsShowPrompt;
        tsScope.hidden = !tsPromptShown;
        tsScope.style.display = tsPromptShown ? "" : "none";
        tsPill.hidden = !tsAssetSection;
        tsPill.style.display = tsAssetSection ? "" : "none";
        const tsRowShown = tsAssetSection && tsOpen;
        // like the Filters pill: lit while its row is shown, a small dot after the
        // name while a list narrows the grid with the row closed
        tsPill.dataset.active = String(tsRowShown);
        tsPill.dataset.applied = String(tsActive() && !tsRowShown);
        tsPill.setAttribute("aria-pressed", String(tsOpen));
        tsPill.dataset.forkOpen = String(tsOpen);
        tsPromptToggle.dataset.active = String(tsShowPrompt);
        tsPromptToggle.setAttribute("aria-pressed", String(tsShowPrompt));
        tsRow.hidden = !tsRowShown;
        tsRow.dataset.open = String(tsRowShown);
    };

    // Both pills sit inside the field's right edge: Multiple at the edge, Prompt to its left.
    const tsApplySearchScopeInset = tsPanel.tsApplySearchScopeInset;
    tsPanel.tsApplySearchScopeInset = function tsForkApplySearchScopeInset(...tsArgs) {
        const tsResult = tsApplySearchScopeInset?.apply(this, tsArgs);
        const tsPillWidth = tsPill.hidden ? 0 : Math.round(tsPill.offsetWidth || 0);
        const tsPromptWidth = tsScope.hidden ? 0 : Math.round(tsScope.offsetWidth || 0);
        tsScope.style.right = tsPillWidth ? `${4 + tsPillWidth + 4}px` : "";
        const tsInset = (tsPillWidth ? tsPillWidth + 8 : 0) + (tsPromptWidth ? tsPromptWidth + 4 : 0);
        tsCluster.style.setProperty("--ts-search-scope-inset", `${tsInset}px`);
        return tsResult;
    };

    const tsRelayout = () => {
        tsPaintPills();
        tsPanel.tsApplySearchScopeInset?.();
        // the row changes the toolbar's height, as the Filters row does
        tsPanel.tsLastObservedToolbarHeight = 0;
        tsPanel.tsApplyToolbarScale?.();
    };

    const tsRenderToolbarForSection = tsPanel.tsRenderToolbarForSection;
    tsPanel.tsRenderToolbarForSection = function tsForkMultipleRenderToolbar(...tsArgs) {
        const tsResult = tsRenderToolbarForSection?.apply(this, tsArgs);
        tsRelayout();
        return tsResult;
    };

    // ---- the request ----
    const tsBuildSearchParams = tsPanel.tsBuildSearchParams;
    tsPanel.tsBuildSearchParams = function tsForkMultipleBuildSearchParams(tsCursorAfter, tsOverrides = {}, ...tsRest) {
        const tsParams = tsBuildSearchParams.call(this, tsCursorAfter, tsOverrides, ...tsRest);
        // an override without filters (upstream's background 3D query) lists everything
        const tsFiltersOff = tsOverrides && Object.prototype.hasOwnProperty.call(tsOverrides, "filters") && !tsOverrides.filters;
        if (!tsFiltersOff) {
            tsSentNames = tsActive() ? tsNames.join("\n") : "";
        }
        if (tsActive() && !tsFiltersOff) {
            tsParams.set("names", tsNames.join("\n"));
        }
        return tsParams;
    };
    // the list the grid's listing was asked for (null: not known yet)
    let tsSentNames = null;
    const tsListingIsCurrent = () => tsSentNames === (tsActive() ? tsNames.join("\n") : "");

    // ---- "not found" ----
    const tsMissingNames = () => {
        const tsFound = new Set();
        for (const tsItem of tsState.tsItems || []) {
            const tsLower = String(tsItem?.filename || "").normalize("NFC").toLowerCase();
            tsNames.forEach((tsName, tsIndex) => {
                if (!tsFound.has(tsIndex) && tsForkLineMatches(tsLower, tsName)) {
                    tsFound.add(tsIndex);
                }
            });
        }
        return tsNames.filter((tsName, tsIndex) => !tsFound.has(tsIndex));
    };
    const tsPaintStatus = () => {
        // Compare needs a list and two files to show
        tsCompareButton.disabled = !tsActive() || (tsState.tsItems || []).length < 2;
        if (!tsNames.length) {
            tsStatus.textContent = tsT("fork.multipleEmpty", "One file name per line, or any part of one. Paste a list to find all of them.");
            tsStatus.dataset.missing = "false";
            tsStatus.title = "";
            return;
        }
        const tsCount = (tsState.tsItems || []).length;
        const tsMore = tsState.tsHasMore ? "+" : "";
        const tsMissing = tsState.tsLoading ? [] : tsMissingNames();
        const tsNamesText = `${tsNames.length} ${tsNames.length === 1 ? tsT("fork.multipleName", "name") : tsT("fork.multipleNames", "names")}`;
        const tsFilesText = `${tsCount}${tsMore} ${tsCount === 1 && !tsMore ? tsT("fork.multipleFile", "file") : tsT("fork.multipleFiles", "files")}`;
        // with more pages to load, a name may only be further down: say "not listed yet"
        const tsMissingText = tsMissing.length
            ? ` · ${tsState.tsHasMore ? tsT("fork.multipleNotYet", "not in the files shown yet") : tsT("fork.multipleNotFound", "not found")}: ${tsMissing.join(", ")}`
            : "";
        tsStatus.textContent = `${tsNamesText} · ${tsFilesText}${tsMissingText}`;
        tsStatus.title = tsMissing.length ? tsMissing.join("\n") : "";
        tsStatus.dataset.missing = String(tsMissing.length > 0);
    };

    const tsFetchAssets = tsPanel.tsFetchAssets;
    tsPanel.tsFetchAssets = function tsForkMultipleFetchAssets(...tsArgs) {
        const tsResult = tsFetchAssets.apply(this, tsArgs);
        Promise.resolve(tsResult).finally(() => tsPaintStatus());
        return tsResult;
    };

    // ---- the empty grid ----
    const tsBuildEmptyState = tsPanel.tsBuildEmptyState;
    tsPanel.tsBuildEmptyState = function tsForkMultipleEmptyState(...tsArgs) {
        const tsEmpty = tsBuildEmptyState.apply(this, tsArgs);
        if (tsActive() && !tsState.tsFetchError && !(tsState.tsItems || []).length) {
            return {
                tsTitle: tsT("fork.multipleNoneTitle", "None of the names in the Multiple list were found."),
                tsLines: [tsNames.slice(0, 6).join(", ") + (tsNames.length > 6 ? ", …" : "")],
                tsAction: { tsAction: "fork-clear-names", tsLabel: tsT("fork.multipleClear", "Clear the list") },
            };
        }
        if (!tsShowPrompt && tsEmpty?.tsAction?.tsAction === "search-prompts") {
            return { ...tsEmpty, tsAction: { tsAction: "clear-search", tsLabel: tsT("empty.clearSearchAction", "Clear search") } };
        }
        return tsEmpty;
    };

    // tsQuiet: no search of its own (fork-goto-folder clears the list and fetches itself)
    const tsSetNames = (tsNextText, tsFromBox = false, tsQuiet = false) => {
        tsText = tsNextText;
        if (!tsFromBox) {
            tsBox.value = tsText;
        }
        tsWriteStored(TS_FORK_NAMES_KEY, tsText);
        const tsNext = tsForkParseNames(tsText);
        const tsChanged = tsNext.join("\n") !== tsNames.join("\n");
        const tsWasActive = tsActive();
        tsNames = tsNext;
        if (tsActive() !== tsWasActive) {
            tsRelayout();       // the pill's small dot comes or goes: its width changes
        } else {
            tsPaintPills();
        }
        tsPaintStatus();
        if (tsChanged && !tsQuiet) {
            // a search, for keep-selection: the selection stays while the list is edited
            tsPanel.tsDebouncedSearch?.();
        }
    };

    const tsHandleEmptyStateClick = tsPanel.tsHandleEmptyStateClick;
    tsPanel.tsHandleEmptyStateClick = function tsForkMultipleEmptyClick(tsEvent, ...tsRest) {
        const tsButton = tsEvent?.target?.closest?.("[data-empty-action]");
        if (tsButton?.dataset.emptyAction === "fork-clear-names") {
            tsSetNames("");
            return undefined;
        }
        return tsHandleEmptyStateClick.call(this, tsEvent, ...tsRest);
    };

    // ---- select all: the button, and Ctrl+A in the panel outside text boxes ----
    let tsSelectingAll = false;
    // true once the selection holds every file listed
    const tsSelectAll = async () => {
        if (tsSelectingAll) {
            return false;
        }
        tsSelectingAll = true;
        try {
            // A list just typed or pasted is still waiting for its search (debounced):
            // wait for it, or the files of the previous listing would be selected.
            // Not a fetch of our own: the waiting one would still run after it and
            // clear the selection made here.
            const tsWaitUntil = Date.now() + 10000;
            while (tsAssets() && (tsState.tsLoading || !tsListingIsCurrent()) && Date.now() < tsWaitUntil) {
                if (!tsState.tsLoading && tsSentNames === null) {
                    tsPanel.tsDebouncedSearch?.();   // not known: ask once
                    tsSentNames = undefined;
                }
                await (tsState.tsLoading && tsPanel.tsCurrentFetchPromise
                    ? tsPanel.tsCurrentFetchPromise
                    : new Promise((tsResolve) => setTimeout(tsResolve, 50)));
            }
            // the pages not shown yet: every file of the listing, up to the cap
            let tsGuard = 0;
            while (tsGuard < 200) {
                tsGuard += 1;
                if (tsState.tsLoading) {
                    await (tsPanel.tsCurrentFetchPromise || new Promise((tsResolve) => setTimeout(tsResolve, 50)));
                    continue;
                }
                if (!tsState.tsHasMore || (tsState.tsItems || []).length >= TS_FORK_SELECT_ALL_CAP) {
                    break;
                }
                const tsBefore = tsState.tsItems.length;
                await tsPanel.tsFetchAssets(false);
                if (tsState.tsItems.length === tsBefore && !tsState.tsLoading) {
                    break;
                }
            }
            let tsItems = [...(tsState.tsItems || [])];
            if (tsActive()) {
                // the list's order: Compare shows the clips as they were pasted
                tsItems = tsItems
                    .map((tsItem, tsIndex) => ({ tsItem, tsIndex, tsLine: tsForkLineIndex(tsNames, tsItem?.filename) }))
                    .sort((tsA, tsB) => (tsA.tsLine < 0 ? 1e9 : tsA.tsLine) - (tsB.tsLine < 0 ? 1e9 : tsB.tsLine) || tsA.tsIndex - tsB.tsIndex)
                    .map((tsEntry) => tsEntry.tsItem);
            }
            if (!tsItems.length) {
                return false;
            }
            tsPanel.tsClearSelection?.();
            for (const tsItem of tsItems) {
                tsState.tsSelection.add(tsItem.id);
            }
            tsState.tsSelectionAnchorId = tsItems[0].id;
            tsState.tsLastSelectedIndex = tsPanel.tsItemIndexById?.get(tsItems[0].id) ?? 0;
            tsPanel.tsRenderSelectionButtons?.();
            tsPanel.tsRefreshCardSelection?.();
            return true;
        } finally {
            tsSelectingAll = false;
            tsPaintStatus();
        }
    };
    tsRefs.tsShell?.addEventListener("keydown", (tsEvent) => {
        if (!(tsEvent.ctrlKey || tsEvent.metaKey) || tsEvent.altKey || tsEvent.shiftKey
            || String(tsEvent.key).toLowerCase() !== "a") {
            return;
        }
        // text boxes keep their own Ctrl+A; the lightbox and the popups own the keyboard
        if (tsPanel.tsIsEditableKeyTarget?.(tsEvent) || tsPanel.tsViewer?.tsIsViewerOpen?.()
            || tsRefs.tsForkSettings?.dataset.open === "true" || tsRefs.tsShortcuts?.dataset.open === "true") {
            return;
        }
        tsEvent.preventDefault();
        void tsSelectAll();
    });

    // ---- events ----
    tsPill.addEventListener("click", () => {
        tsOpen = !tsOpen;
        tsWriteStored(TS_FORK_OPEN_KEY, tsOpen ? "1" : "0");
        tsRelayout();
        tsPaintStatus();
        if (tsOpen) {
            tsBox.focus();
        }
    });
    tsBox.addEventListener("input", () => tsSetNames(tsBox.value, true));
    tsClearButton.addEventListener("click", () => {
        tsSetNames("");
        tsBox.focus();
    });
    tsSelectAllButton.addEventListener("click", () => void tsSelectAll());
    // Select all, then the bar's Compare: the first six of the list, in its order
    const tsCompareAll = async () => {
        if (tsActive() && await tsSelectAll()) {
            tsPanel.tsCompareSelected?.();
        }
    };
    tsCompareButton.addEventListener("click", () => void tsCompareAll());
    // Ctrl+Enter in the box: the same as Compare
    tsBox.addEventListener("keydown", (tsEvent) => {
        if (tsEvent.key === "Enter" && (tsEvent.ctrlKey || tsEvent.metaKey) && !tsEvent.altKey && !tsEvent.shiftKey) {
            tsEvent.preventDefault();
            tsEvent.stopPropagation();
            void tsCompareAll();
        }
    });
    tsPromptToggle.addEventListener("click", () => {
        tsShowPrompt = !tsShowPrompt;
        tsWriteStored(TS_FORK_SHOW_PROMPT_KEY, tsShowPrompt ? "1" : "0");
        const tsRefetch = tsForceFilenameScope() && String(tsState.tsSearch || "").trim();
        tsRelayout();
        if (tsRefetch) {
            tsPanel.tsFetchAssets(true);
        }
    });

    // ---- texts ----
    const tsHydrateText = tsPanel.tsHydrateText;
    const tsTexts = () => {
        tsPill.textContent = tsT("fork.multiple", "Multiple");
        tsPill.title = tsT("fork.multipleTip", "Find many files at once: one file name per line.");
        tsBox.placeholder = tsT("fork.multiplePlaceholder", "clip_00012.mp4\nclip_00031.mp4\nany part of a name");
        tsCompareButton.textContent = tsT("button.compareSelected", "Compare");
        tsCompareButton.title = tsT("fork.multipleCompareTip", "Select every file listed and compare them, in the list's order (the first six). Ctrl+Enter in the box does the same.");
        tsSelectAllButton.textContent = tsT("fork.selectAll", "Select all");
        tsSelectAllButton.title = tsT("fork.selectAllTip", "Select every file listed (Ctrl+A), in the list's order");
        tsClearButton.textContent = tsT("filter.clear", "Clear");
        tsPaintStatus();
    };
    if (typeof tsHydrateText === "function") {
        tsPanel.tsHydrateText = function tsForkMultipleHydrateText(...tsArgs) {
            const tsResult = tsHydrateText.apply(this, tsArgs);
            tsTexts();
            return tsResult;
        };
    }

    tsForceFilenameScope();
    tsTexts();
    tsRelayout();
    tsRefs.tsForkMultiple = tsRow;
    tsRefs.tsForkMultiplePill = tsPill;
    tsRefs.tsForkSelectAll = tsSelectAll;
    tsRefs.tsForkMultipleClearQuietly = () => tsSetNames("", false, true);
    // keep-selection: with a list, a comparison shows the clips in the selection's order
    tsRefs.tsForkCompareInSelectionOrder = tsActive;
}
