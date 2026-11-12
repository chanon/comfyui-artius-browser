// obvpm fork: a "Length" filter (min / max, in seconds) in the filter row,
// after Width and Height.
//
// Sent to the server as `min_duration` / `max_duration` on the search request;
// ts_routes.py reads them and ts_db_query.py compares them with the length the
// index stored for each file (both ends included). Files without a length --
// images, and the odd file whose length could not be read -- never match, so
// they are hidden while a length is set. A server without the fork's Python
// ignores the two parameters and lists everything.
//
// The values live on the panel's state (tsForkFilterMinDuration /
// tsForkFilterMaxDuration) so root memory keeps them per root like the other
// filters; the root on screen keeps its values in this browser's localStorage
// (the pack's settings file accepts a fixed list of keys).
//
// The panel is hooked on the INSTANCE, its file is not edited:
//   - tsBuildSearchParams: every asset request is built there.
//   - tsHasActiveFilters: the dot on the Filters button.
//   - tsSyncFilterInputs: fills the inputs when the row opens or the root changes.
//   - tsClearFilters: Clear empties the length too.
//   - tsHydrateText: labels, again on a language change.

const TS_FORK_LENGTH_KEY = "tsab.fork.lengthFilter";

// seconds, never negative, 3 decimals (the index stores e.g. 5.125 s)
export function tsForkCleanSeconds(tsValue) {
    const tsNumber = Number(tsValue);
    if (!Number.isFinite(tsNumber) || tsNumber <= 0) {
        return 0;
    }
    return Math.round(tsNumber * 1000) / 1000;
}

function tsReadStored() {
    try {
        const tsParsed = JSON.parse(window.localStorage?.getItem(TS_FORK_LENGTH_KEY) || "{}");
        return { min: tsForkCleanSeconds(tsParsed?.min), max: tsForkCleanSeconds(tsParsed?.max) };
    } catch (tsError) {
        return { min: 0, max: 0 };
    }
}

function tsWriteStored(tsMin, tsMax) {
    try {
        window.localStorage?.setItem(TS_FORK_LENGTH_KEY, JSON.stringify({ min: tsMin, max: tsMax }));
    } catch (tsError) {
        // not persisted; still works until the page reloads
    }
}

export function tsInstallForkLengthFilter(tsPanel) {
    const tsRefs = tsPanel?.tsRefs;
    const tsFilterPanel = tsRefs?.tsFilterPanel;
    const tsClearButton = tsRefs?.tsFilterClear;
    if (!tsFilterPanel || !tsClearButton || tsRefs.tsForkLengthField) {
        return;
    }
    const tsT = (tsKey, tsFallback) => tsPanel.tsT?.(tsKey, tsFallback) || tsFallback;
    const tsState = tsPanel.tsState;
    const tsStored = tsReadStored();
    tsState.tsForkFilterMinDuration = tsStored.min;
    tsState.tsForkFilterMaxDuration = tsStored.max;

    // same markup and classes as upstream's Width / Height fields
    const tsField = document.createElement("div");
    tsField.className = "ts-filter-field ts-filter-res ts-fork-filter-length";
    const tsLabel = document.createElement("span");
    tsLabel.className = "ts-filter-label ts-fork-filter-label-length";
    const tsMin = document.createElement("input");
    const tsMax = document.createElement("input");
    for (const [tsInput, tsClass] of [[tsMin, "ts-fork-filter-min-duration"], [tsMax, "ts-fork-filter-max-duration"]]) {
        tsInput.className = tsClass;
        tsInput.type = "number";
        tsInput.min = "0";
        tsInput.step = "0.1";
        tsInput.inputMode = "decimal";
    }
    const tsDash = document.createElement("span");
    tsDash.className = "ts-filter-dash";
    tsDash.textContent = "–";
    const tsUnit = document.createElement("span");
    tsUnit.className = "ts-filter-dash ts-fork-filter-unit";
    tsUnit.textContent = "s";
    tsField.append(tsLabel, tsMin, tsDash, tsMax, tsUnit);
    tsClearButton.before(tsField);
    tsRefs.tsForkLengthField = tsField;

    const tsShowValues = () => {
        // leave an input alone while it is being typed in ("5." is not a number yet)
        if (tsMin !== tsPanel.shadowRoot?.activeElement) {
            tsMin.value = tsState.tsForkFilterMinDuration ? String(tsState.tsForkFilterMinDuration) : "";
        }
        if (tsMax !== tsPanel.shadowRoot?.activeElement) {
            tsMax.value = tsState.tsForkFilterMaxDuration ? String(tsState.tsForkFilterMaxDuration) : "";
        }
    };
    let tsStoredPair = `${tsStored.min}|${tsStored.max}`;
    const tsStore = () => {
        const tsPair = `${tsState.tsForkFilterMinDuration}|${tsState.tsForkFilterMaxDuration}`;
        if (tsPair !== tsStoredPair) {
            tsStoredPair = tsPair;
            tsWriteStored(tsState.tsForkFilterMinDuration, tsState.tsForkFilterMaxDuration);
        }
    };

    for (const [tsInput, tsKey] of [[tsMin, "tsForkFilterMinDuration"], [tsMax, "tsForkFilterMaxDuration"]]) {
        tsInput.addEventListener("input", () => {
            const tsValue = tsForkCleanSeconds(tsInput.value);
            if (tsValue === tsState[tsKey]) {
                return;
            }
            tsState[tsKey] = tsValue;
            tsStore();
            tsPanel.tsRenderFiltersToggle?.();
            // typing "12.5" is four keystrokes: one request after the last
            tsPanel.tsDebouncedFilterInputRefresh?.();
        });
        tsInput.addEventListener("blur", tsShowValues);
    }

    const tsTexts = () => {
        tsLabel.textContent = tsT("fork.filterLength", "Length");
        tsField.title = tsT("fork.filterLengthTip", "Video and audio length in seconds, both ends included. Images have no length, so they are hidden while a length is set.");
        tsMin.placeholder = tsT("filter.min", "min");
        tsMax.placeholder = tsT("filter.max", "max");
    };

    const tsBuildSearchParams = tsPanel.tsBuildSearchParams;
    tsPanel.tsBuildSearchParams = function tsForkLengthBuildSearchParams(tsCursorAfter, tsOverrides = {}, ...tsRest) {
        const tsParams = tsBuildSearchParams.call(this, tsCursorAfter, tsOverrides, ...tsRest);
        // root memory may have swapped the values in while the row was closed
        tsState.tsForkFilterMinDuration = tsForkCleanSeconds(tsState.tsForkFilterMinDuration);
        tsState.tsForkFilterMaxDuration = tsForkCleanSeconds(tsState.tsForkFilterMaxDuration);
        tsStore();
        // an override without filters (or the Workflows section) means no filters at all
        const tsFiltersOff = this.tsIsWorkflowSection?.()
            || (tsOverrides && Object.prototype.hasOwnProperty.call(tsOverrides, "filters") && !tsOverrides.filters);
        if (!tsFiltersOff) {
            if (tsState.tsForkFilterMinDuration > 0) {
                tsParams.set("min_duration", String(tsState.tsForkFilterMinDuration));
            }
            if (tsState.tsForkFilterMaxDuration > 0) {
                tsParams.set("max_duration", String(tsState.tsForkFilterMaxDuration));
            }
        }
        return tsParams;
    };

    const tsHasActiveFilters = tsPanel.tsHasActiveFilters;
    tsPanel.tsHasActiveFilters = function tsForkLengthHasActiveFilters(...tsArgs) {
        return Boolean(tsHasActiveFilters.apply(this, tsArgs)
            || tsState.tsForkFilterMinDuration > 0
            || tsState.tsForkFilterMaxDuration > 0);
    };

    const tsSyncFilterInputs = tsPanel.tsSyncFilterInputs;
    tsPanel.tsSyncFilterInputs = function tsForkLengthSyncFilterInputs(...tsArgs) {
        // root memory may have put another root's values on the state
        tsState.tsForkFilterMinDuration = tsForkCleanSeconds(tsState.tsForkFilterMinDuration);
        tsState.tsForkFilterMaxDuration = tsForkCleanSeconds(tsState.tsForkFilterMaxDuration);
        tsStore();
        tsShowValues();
        return tsSyncFilterInputs.apply(this, tsArgs);
    };

    const tsClearFilters = tsPanel.tsClearFilters;
    tsPanel.tsClearFilters = function tsForkLengthClearFilters(...tsArgs) {
        tsState.tsForkFilterMinDuration = 0;
        tsState.tsForkFilterMaxDuration = 0;
        tsStore();
        tsMin.value = "";
        tsMax.value = "";
        return tsClearFilters.apply(this, tsArgs);
    };

    const tsHydrateText = tsPanel.tsHydrateText;
    if (typeof tsHydrateText === "function") {
        tsPanel.tsHydrateText = function tsForkLengthHydrateText(...tsArgs) {
            const tsResult = tsHydrateText.apply(this, tsArgs);
            tsTexts();
            return tsResult;
        };
    }
    tsTexts();
    tsShowValues();
    tsPanel.tsRenderFiltersToggle?.();
}
