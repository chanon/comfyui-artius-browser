// obvpm fork: "Hide 3D" -- for people who never browse 3D files. On (the
// default), the 3D chip leaves the type chips.
//
// Only the chip goes: with no chip picked the listing still shows every type,
// 3D files included, exactly as upstream does. A 3D chip that was picked when
// the option comes on is un-picked first, so no filter is left active that
// can no longer be seen or turned off.
//
// Kept in this browser's localStorage, like the fork's other options: the
// pack's settings file accepts a fixed list of keys.
//
// The panel is hooked on the INSTANCE, its file is not edited:
//   - tsRenderTypeChips: it rebuilds the chips by innerHTML each time, so the
//     chip is hidden again after every render. The first render comes right
//     after the saved settings load and before the first fetch, so a saved
//     3D pick is dropped before anything is listed with it.

const TS_FORK_HIDE_3D_KEY = "tsab.fork.hide3d";
const TS_FORK_3D_TYPE = "3d";

function tsReadStored() {
    try {
        return window.localStorage?.getItem(TS_FORK_HIDE_3D_KEY) !== "0";      // default ON
    } catch (tsError) {
        return true;
    }
}

function tsWriteStored(tsOn) {
    try {
        window.localStorage?.setItem(TS_FORK_HIDE_3D_KEY, tsOn ? "1" : "0");
    } catch (tsError) {
        // not persisted; the option still works until the page reloads
    }
}

export function tsInstallForkHide3D(tsPanel) {
    const tsRefs = tsPanel?.tsRefs;
    if (!tsRefs?.tsTypeChips || typeof tsRefs.tsForkSettingsAddRow !== "function"
        || typeof tsPanel.tsRenderTypeChips !== "function" || tsRefs.tsForkHide3D) {
        return;
    }
    let tsOn = tsReadStored();

    const tsToggle = document.createElement("button");
    tsToggle.type = "button";
    tsToggle.className = "ts-toggle-button ts-fork-hide-3d";
    const tsLabel = document.createElement("span");
    tsToggle.append(tsLabel);

    const tsHideChip = () => {
        const tsChip = tsRefs.tsTypeChips.querySelector(`[data-type="${TS_FORK_3D_TYPE}"]`);
        if (tsChip) {
            tsChip.hidden = tsOn;
            tsChip.style.display = tsOn ? "none" : "";
        }
    };

    // A picked 3D chip would go on filtering out of sight: un-pick it.
    const tsDropHiddenType = () => {
        if (!tsOn || !tsPanel.tsState?.tsTypes?.has(TS_FORK_3D_TYPE)) {
            return false;
        }
        tsPanel.tsState.tsTypes.delete(TS_FORK_3D_TYPE);
        tsPanel.tsQueueSaveUISettings?.();
        return true;
    };

    const tsRenderTypeChips = tsPanel.tsRenderTypeChips;
    tsPanel.tsRenderTypeChips = function tsForkRenderTypeChips(...tsArgs) {
        tsDropHiddenType();             // the chips are then built from the corrected set
        const tsResult = tsRenderTypeChips.apply(this, tsArgs);
        tsHideChip();
        return tsResult;
    };

    const tsApply = () => {
        tsToggle.dataset.active = String(tsOn);
        tsToggle.setAttribute("aria-pressed", String(tsOn));
        tsPanel.tsRenderTypeChips();
    };

    tsToggle.addEventListener("click", () => {
        tsOn = !tsOn;
        tsWriteStored(tsOn);
        const tsHadPick = tsOn && tsPanel.tsState?.tsTypes?.has(TS_FORK_3D_TYPE);
        tsApply();
        if (tsHadPick) {
            tsPanel.tsDebouncedFilterRefresh?.();     // as a chip click refreshes
        }
    });

    tsRefs.tsForkSettingsAddRow(tsToggle, (tsT) => {
        tsLabel.textContent = tsT("fork.hide3d", "Hide 3D");
        return tsT("fork.hide3dHint",
            "Hide the 3D chip from the type chips. 3D files still show when no type is picked.");
    });
    // For the per-root memory: a restored 3D pick is dropped while hidden.
    tsRefs.tsForkHide3DValue = { get: () => tsOn };
    tsRefs.tsForkHide3D = tsToggle;
    tsApply();
}
