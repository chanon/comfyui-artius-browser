// obvpm fork: "Only show Assets" -- for people who never use the workflow
// browser. On, the Assets / Workflows switch leaves the toolbar and the panel
// stays in the Assets section.
//
// The choice is kept in this browser's localStorage, not in the pack's
// settings file: the server normalises that file against a fixed list of
// keys, so a new key would mean editing upstream's Python for what is a
// display preference. Storage that is unavailable (a private window) just
// means the option does not survive a reload.
//
// The panel is hooked on the INSTANCE, its file is not edited:
//   - tsSetSection: refuses "workflows" while the option is on. The two
//     toolbar buttons are its only callers today; this also covers any
//     shortcut upstream may add later.
//   - tsInitAsync: the section is restored from the saved settings during
//     init, so a session saved in Workflows (another tab, an older build)
//     would come back there with no switch to leave it. After init, go home.

const TS_FORK_ASSETS_ONLY_KEY = "tsab.fork.assetsOnly";

function tsReadStored() {
    try {
        return window.localStorage?.getItem(TS_FORK_ASSETS_ONLY_KEY) === "1";
    } catch (tsError) {
        return false;
    }
}

function tsWriteStored(tsOn) {
    try {
        window.localStorage?.setItem(TS_FORK_ASSETS_ONLY_KEY, tsOn ? "1" : "0");
    } catch (tsError) {
        // not persisted; the option still works until the page reloads
    }
}

export function tsInstallForkAssetsOnly(tsPanel) {
    const tsRefs = tsPanel?.tsRefs;
    const tsSectionGroup = tsRefs?.tsSectionAssets?.parentNode;
    if (!tsSectionGroup || typeof tsRefs.tsForkSettingsAddRow !== "function" || tsRefs.tsForkAssetsOnly) {
        return;
    }
    let tsOn = tsReadStored();

    const tsToggle = document.createElement("button");
    tsToggle.type = "button";
    tsToggle.className = "ts-toggle-button ts-fork-assets-only";
    const tsLabel = document.createElement("span");
    tsToggle.append(tsLabel);

    const tsGoHome = () => {
        if (tsOn && tsPanel.tsIsWorkflowSection?.()) {
            // the panel's own switch, so every per-section setting follows
            return tsSetSection.call(tsPanel, "assets");
        }
        return undefined;
    };
    const tsApply = () => {
        tsToggle.dataset.active = String(tsOn);
        tsToggle.setAttribute("aria-pressed", String(tsOn));
        tsSectionGroup.hidden = tsOn;
        // `hidden` alone loses to the cluster's own `display: inline-flex`
        tsSectionGroup.style.display = tsOn ? "none" : "";
    };

    const tsSetSection = tsPanel.tsSetSection;
    tsPanel.tsSetSection = function tsForkSetSection(tsSection, ...tsRest) {
        if (tsOn && tsSection === "workflows") {
            return Promise.resolve();
        }
        return tsSetSection.call(this, tsSection, ...tsRest);
    };

    const tsInitAsync = tsPanel.tsInitAsync;
    if (typeof tsInitAsync === "function") {
        tsPanel.tsInitAsync = async function tsForkInitAsync(...tsArgs) {
            const tsResult = await tsInitAsync.apply(this, tsArgs);
            await tsGoHome();
            return tsResult;
        };
    }

    tsToggle.addEventListener("click", () => {
        tsOn = !tsOn;
        tsWriteStored(tsOn);
        tsApply();
        void tsGoHome();
    });

    tsRefs.tsForkSettingsAddRow(tsToggle, (tsT) => {
        tsLabel.textContent = tsT("fork.assetsOnly", "Only show Assets");
        return tsT("fork.assetsOnlyHint",
            "Hide the Assets / Workflows switch and always stay in the asset browser.");
    });
    tsRefs.tsForkAssetsOnly = tsToggle;
    tsApply();
}
