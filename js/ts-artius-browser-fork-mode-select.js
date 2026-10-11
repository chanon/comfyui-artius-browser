// obvpm fork: Flat / Tree as one dropdown instead of two buttons, to save
// toolbar width.
//
// The two buttons stay in the page, hidden: picking an entry clicks the
// matching button, so the panel's own tsSetMode does the switch (folder,
// save, fetch) and the fork's Recurse follows it as before. The entries take
// the buttons' text and tooltips, which the panel translates.
//
// The panel is hooked on the INSTANCE, its file is not edited:
//   - tsRenderModeButtons: the panel calls it whenever the mode changes
//     (also on a section switch and a settings restore), so the dropdown
//     shows the mode from there.
//   - tsHydrateText: the buttons' labels are (re)set there on a language
//     change.

export function tsInstallForkModeSelect(tsPanel) {
    const tsRefs = tsPanel?.tsRefs;
    const tsFlat = tsRefs?.tsModeFlat;
    const tsTree = tsRefs?.tsModeTree;
    const tsGroup = tsFlat?.parentNode;
    if (!tsFlat || !tsTree || !tsGroup || typeof tsPanel.tsRenderModeButtons !== "function"
        || tsRefs.tsForkModeSelect) {
        return;
    }

    const tsSelect = document.createElement("select");
    tsSelect.className = "ts-fork-mode-select";
    const tsButtons = { flat: tsFlat, tree: tsTree };
    for (const tsMode of Object.keys(tsButtons)) {
        const tsOption = document.createElement("option");
        tsOption.value = tsMode;
        tsSelect.append(tsOption);
    }
    tsGroup.dataset.forkModeSelect = "true";
    tsGroup.append(tsSelect);

    const tsPaint = () => {
        for (const tsOption of tsSelect.options) {
            const tsButton = tsButtons[tsOption.value];
            tsOption.textContent = tsButton.textContent || tsOption.value;
        }
        const tsMode = tsPanel.tsState?.tsMode === "tree" ? "tree" : "flat";
        tsSelect.value = tsMode;
        tsSelect.title = tsButtons[tsMode].title || "";
        tsPanel.tsResizeSelectToCurrent?.(tsSelect);
    };

    tsSelect.addEventListener("change", () => {
        const tsButton = tsButtons[tsSelect.value];
        if (tsButton && tsPanel.tsState?.tsMode !== tsSelect.value) {
            tsButton.click();           // the panel's own switch
        }
        tsPaint();
    });

    for (const tsName of ["tsRenderModeButtons", "tsHydrateText"]) {
        const tsOriginal = tsPanel[tsName];
        if (typeof tsOriginal !== "function") {
            continue;
        }
        tsPanel[tsName] = function tsForkModeSelectFollow(...tsArgs) {
            const tsResult = tsOriginal.apply(this, tsArgs);
            tsPaint();
            return tsResult;
        };
    }

    tsRefs.tsForkModeSelect = tsSelect;
    tsPaint();
}
