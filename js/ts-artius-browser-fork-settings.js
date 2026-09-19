// obvpm fork: a settings popup for the controls nobody changes often.
//
// The toolbar row carried Autoscan and Rebuild Cache next to the things
// used every minute. This moves them into a popup behind one gear button
// in the title row, after the donate link.
//
// They are MOVED, not rebuilt: the very same elements the panel created,
// with the listeners, labels, tooltips, `hidden` and `disabled` handling
// the panel already gives them through tsRefs. So nothing about how they
// work changes, and the panel file needs an import and one call -- which
// keeps merging upstream easy. Everything the fork adds lives here and in
// the fork block at the end of the panel stylesheet.

const TS_FORK_MOVED = [
    // [the panel's ref, the locale key of its tooltip, English fallback]
    ["tsAutoscan", "tooltip.autoscan",
        "Automatically rescan assets when the browser starts or when ComfyUI finishes execution."],
    ["tsRebuildCache", "tooltip.rebuildCache",
        "Delete the current browser cache and rebuild it from scratch."],
];

export function tsInstallForkSettings(tsPanel) {
    const tsRefs = tsPanel?.tsRefs;
    const tsToolbarMain = tsRefs?.tsToolbarMain;
    const tsAnchor = tsRefs?.tsShortcuts;
    if (!tsToolbarMain || !tsAnchor?.parentNode || tsRefs.tsForkSettings) {
        return;
    }
    const tsT = (tsKey, tsFallback) => tsPanel.tsT?.(tsKey, tsFallback) || tsFallback;

    // The gear sits in the TITLE row, the panel's top line, right after the
    // donate link: out of the way of the controls used every minute, and
    // outside the scaled, clipped toolbar wrap below it.
    const tsButton = document.createElement("button");
    tsButton.type = "button";
    tsButton.className = "ts-fork-settings-button";
    tsButton.textContent = "⚙";
    const tsDonate = tsRefs.tsTitle?.querySelector(".ts-donate");
    if (tsDonate) {
        tsDonate.after(tsButton);
    } else {
        (tsRefs.tsTitle || tsToolbarMain).append(tsButton);
    }

    // Same overlay as the keyboard-shortcuts help, so it looks native: its
    // inner classes are reused for their styling only. The overlay's OWN
    // class is separate -- the panel finds its shortcuts overlay with
    // querySelector(".ts-shortcuts") and must keep finding that one.
    const tsOverlay = document.createElement("div");
    tsOverlay.className = "ts-fork-settings";
    tsOverlay.dataset.open = "false";
    tsOverlay.hidden = true;
    tsOverlay.setAttribute("role", "dialog");
    tsOverlay.setAttribute("aria-modal", "true");
    tsOverlay.innerHTML = `
        <div class="ts-shortcuts-panel">
            <div class="ts-shortcuts-head">
                <h3 class="ts-fork-settings-title"></h3>
                <button class="ts-shortcuts-close ts-fork-settings-close" type="button">×</button>
            </div>
            <div class="ts-fork-settings-body"></div>
            <div class="ts-fork-settings-note" hidden></div>
        </div>`;
    const tsBody = tsOverlay.querySelector(".ts-fork-settings-body");
    const tsNote = tsOverlay.querySelector(".ts-fork-settings-note");
    const tsTitle = tsOverlay.querySelector(".ts-fork-settings-title");
    const tsClose = tsOverlay.querySelector(".ts-fork-settings-close");

    const tsRows = [];
    for (const [tsRefName, tsHintKey, tsHintFallback] of TS_FORK_MOVED) {
        const tsControl = tsRefs[tsRefName];
        if (!tsControl) {
            continue;
        }
        const tsRow = document.createElement("div");
        tsRow.className = "ts-fork-settings-row";
        const tsHint = document.createElement("div");
        tsHint.className = "ts-fork-settings-hint";
        tsRow.append(tsControl, tsHint);      // append MOVES it out of the toolbar
        tsBody.append(tsRow);
        tsRows.push({
            tsRow, tsControl, tsHint, tsFollowsControl: true,
            tsHintText: (tsTranslate) => tsTranslate(tsHintKey, tsHintFallback),
        });
    }
    tsAnchor.parentNode.insertBefore(tsOverlay, tsAnchor.nextSibling);

    const tsHydrate = () => {
        const tsLabel = tsT("fork.settings", "Settings");
        tsButton.title = tsLabel;
        tsButton.setAttribute("aria-label", tsLabel);
        tsTitle.textContent = tsLabel;
        tsClose.setAttribute("aria-label", tsT("button.close", "Close"));
        tsNote.textContent = tsT("fork.settingsAssetsSection",
            "Autoscan and Rebuild Cache belong to the Assets section.");
        for (const tsEntry of tsRows) {
            tsEntry.tsHint.textContent = tsEntry.tsHintText(tsT) || "";
        }
    };

    // Other fork features put their own option in the popup through this.
    // `tsHintText(tsT)` runs on every hydrate: it returns the hint and may
    // set the control's own label on the way, so both follow the locale.
    tsRefs.tsForkSettingsAddRow = (tsControl, tsHintText) => {
        const tsRow = document.createElement("div");
        tsRow.className = "ts-fork-settings-row";
        const tsHint = document.createElement("div");
        tsHint.className = "ts-fork-settings-hint";
        tsRow.append(tsControl, tsHint);
        tsBody.append(tsRow);
        tsRows.push({ tsRow, tsControl, tsHint, tsFollowsControl: false, tsHintText });
        tsHydrate();
        return tsRow;
    };

    const tsSetOpen = (tsOpen) => {
        if (tsOpen) {
            tsPanel.tsCloseContextMenu?.();
            tsHydrate();        // the locale can change while the panel lives
            // The panel hides the controls it owns in the Workflows section.
            // Such a row follows its control, and the popup says why rows are
            // missing. The fork's own options are always there.
            let tsMissing = 0;
            for (const tsEntry of tsRows) {
                const tsGone = tsEntry.tsFollowsControl && (tsEntry.tsControl.hidden
                    || tsEntry.tsControl.style.display === "none");
                tsEntry.tsRow.hidden = tsGone;
                tsMissing += tsGone ? 1 : 0;
            }
            tsNote.hidden = tsMissing === 0;
        }
        tsOverlay.dataset.open = String(tsOpen);
        tsOverlay.hidden = !tsOpen;
        (tsOpen ? tsClose : tsButton).focus?.();
    };

    tsButton.addEventListener("click", () => tsSetOpen(tsOverlay.dataset.open !== "true"));
    tsClose.addEventListener("click", () => tsSetOpen(false));
    tsOverlay.addEventListener("click", (tsEvent) => {
        if (tsEvent.target === tsOverlay) {
            tsSetOpen(false);
        }
    });
    // Rebuild Cache asks for confirmation and then runs for a while: get out
    // of its way. Autoscan is a toggle, so the popup stays for that one.
    tsRefs.tsRebuildCache?.addEventListener("click", () => tsSetOpen(false));
    // While the popup is open the keyboard is ITS: the panel's own handler
    // sits on the shell and would move the grid selection, open the lightbox
    // on Enter or delete on Delete behind a modal. Two listeners, because
    // focus decides the path: on the overlay for keys pressed inside it (the
    // popup takes focus when it opens), and in the capture phase on the shell
    // for keys pressed anywhere else in the panel. Neither prevents the
    // default, so Tab, Space and Enter still work on the popup's controls.
    const tsOwnKeys = (tsEvent) => {
        if (tsOverlay.dataset.open !== "true") {
            return;
        }
        tsEvent.stopPropagation();
        if (tsEvent.key === "Escape") {
            tsEvent.preventDefault();
            tsSetOpen(false);
        }
    };
    tsOverlay.addEventListener("keydown", tsOwnKeys);
    tsRefs.tsShell?.addEventListener("keydown", tsOwnKeys, true);

    tsHydrate();
    tsRefs.tsForkSettings = tsOverlay;
    tsRefs.tsForkSettingsButton = tsButton;
}
