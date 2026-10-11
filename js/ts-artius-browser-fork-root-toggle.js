// obvpm fork: "Input / Output as a toggle" -- the root dropdown becomes a
// pair of buttons, Input | Output. On by default.
//
// One button per configured root, Input first, then Output, then any custom
// roots in the panel's order. "All" has no
// button: with the toggle on, a saved "All" moves to Output. Turning the
// option off brings the dropdown back, "All" included.
//
// The dropdown stays in the page, hidden: a button sets its value and fires
// its `change`, so the panel's own handler does the switch -- the folder
// reset, the save, the fetch, and the fork's per-root memory, which listens
// for that same event.
//
// Kept in this browser's localStorage, like the fork's other options.
//
// The panel is hooked on the INSTANCE, its file is not edited:
//   - tsRenderRootOptions: the panel rebuilds the dropdown there whenever
//     the roots or the selected root change, so the buttons follow it.

const TS_FORK_ROOT_TOGGLE_KEY = "tsab.fork.rootToggle";
const TS_FORK_ROOT_PREFERRED = "output";
const TS_FORK_ROOT_FIRST = ["input", "output"];      // the buttons' order

function tsReadStored() {
    try {
        return window.localStorage?.getItem(TS_FORK_ROOT_TOGGLE_KEY) !== "0";  // default ON
    } catch (tsError) {
        return true;
    }
}

function tsWriteStored(tsOn) {
    try {
        window.localStorage?.setItem(TS_FORK_ROOT_TOGGLE_KEY, tsOn ? "1" : "0");
    } catch (tsError) {
        // not persisted; the option still works until the page reloads
    }
}

export function tsInstallForkRootToggle(tsPanel) {
    const tsRefs = tsPanel?.tsRefs;
    const tsGroup = tsRefs?.tsRootGroup;
    const tsSelect = tsRefs?.tsRootSelect;
    if (!tsGroup || !tsSelect || typeof tsRefs.tsForkSettingsAddRow !== "function"
        || typeof tsPanel.tsRenderRootOptions !== "function" || tsRefs.tsForkRootToggle) {
        return;
    }
    let tsOn = tsReadStored();
    let tsButtonsKey = "";
    let tsMovePending = false;

    const tsBox = document.createElement("div");
    tsBox.className = "ts-fork-root-toggle";
    tsGroup.append(tsBox);

    const tsRank = (tsRoot) => {
        const tsAt = TS_FORK_ROOT_FIRST.indexOf(tsRoot.root_id);
        return tsAt < 0 ? TS_FORK_ROOT_FIRST.length : tsAt;
    };
    const tsRoots = () => (tsPanel.tsState?.tsRoots || [])
        .filter((tsRoot) => tsRoot?.root_id && tsRoot.root_id !== "all" && tsRoot.root_id !== "workflows")
        .map((tsRoot, tsIndex) => ({ tsRoot, tsIndex }))
        .sort((a, b) => tsRank(a.tsRoot) - tsRank(b.tsRoot) || a.tsIndex - b.tsIndex)
        .map((tsEntry) => tsEntry.tsRoot);

    // The panel's own switch: its change handler does everything else.
    const tsChoose = (tsRootId) => {
        if (tsPanel.tsState?.tsRootId === tsRootId) {
            return;
        }
        tsSelect.value = tsRootId;
        tsSelect.dispatchEvent(new Event("change", { bubbles: true }));
    };

    const tsRender = () => {
        const tsList = tsRoots();
        const tsUsed = tsOn && tsList.length > 0;
        tsGroup.dataset.forkRootToggle = String(tsUsed);
        tsBox.hidden = !tsUsed;
        const tsKey = JSON.stringify(tsList.map((tsRoot) => [tsRoot.root_id, tsRoot.label || ""]));
        if (tsKey !== tsButtonsKey) {
            tsButtonsKey = tsKey;
            tsBox.replaceChildren(...tsList.map((tsRoot) => {
                const tsButton = document.createElement("button");
                tsButton.type = "button";
                tsButton.className = "ts-mode-button ts-fork-root-button";
                tsButton.dataset.rootId = tsRoot.root_id;
                tsButton.textContent = tsRoot.label || tsRoot.root_id;
                tsButton.addEventListener("click", () => tsChoose(tsRoot.root_id));
                return tsButton;
            }));
        }
        const tsCurrent = tsPanel.tsState?.tsRootId;
        for (const tsButton of tsBox.children) {
            const tsActive = tsButton.dataset.rootId === tsCurrent;
            tsButton.dataset.active = String(tsActive);
            tsButton.setAttribute("aria-pressed", String(tsActive));
            tsButton.title = tsSelect.title || "";
        }
        // "All" has no button: move to Output (or the first root). Deferred,
        // because this runs inside the panel's render and fetch.
        if (tsUsed && !tsMovePending && tsCurrent === "all" && !tsPanel.tsIsWorkflowSection?.()
            && tsPanel.tsState?.tsSettingsHydrated) {
            tsMovePending = true;
            window.setTimeout(() => {
                tsMovePending = false;
                const tsNow = tsRoots();
                if (tsOn && tsPanel.tsState?.tsRootId === "all" && tsNow.length && !tsPanel.tsIsWorkflowSection?.()) {
                    const tsTarget = tsNow.find((tsRoot) => tsRoot.root_id === TS_FORK_ROOT_PREFERRED) || tsNow[0];
                    tsChoose(tsTarget.root_id);
                }
            }, 0);
        }
    };

    const tsRenderRootOptions = tsPanel.tsRenderRootOptions;
    tsPanel.tsRenderRootOptions = function tsForkRenderRootOptions(...tsArgs) {
        const tsResult = tsRenderRootOptions.apply(this, tsArgs);
        tsRender();
        return tsResult;
    };
    // The panel also sets the root without re-rendering the options (the
    // dropdown itself, Assets <-> Workflows): follow the dropdown too.
    tsSelect.addEventListener("change", () => tsRender());

    const tsToggle = document.createElement("button");
    tsToggle.type = "button";
    tsToggle.className = "ts-toggle-button ts-fork-root-toggle-option";
    const tsLabel = document.createElement("span");
    tsToggle.append(tsLabel);

    const tsApply = () => {
        tsToggle.dataset.active = String(tsOn);
        tsToggle.setAttribute("aria-pressed", String(tsOn));
        tsRender();
        // the row can change width: let the toolbar re-measure its height
        tsPanel.tsApplyToolbarScale?.();
    };

    tsToggle.addEventListener("click", () => {
        tsOn = !tsOn;
        tsWriteStored(tsOn);
        tsApply();
    });

    tsRefs.tsForkSettingsAddRow(tsToggle, (tsT) => {
        tsLabel.textContent = tsT("fork.rootToggle", "Input / Output as a toggle");
        return tsT("fork.rootToggleHint",
            "Show Input and Output as two buttons instead of a dropdown. Off brings the dropdown back, with All.");
    });
    tsRefs.tsForkRootToggle = tsToggle;
    tsApply();
}
