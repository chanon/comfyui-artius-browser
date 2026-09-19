// obvpm fork: the filename on every thumbnail, as a pill in the bottom corner,
// a size larger than the type / resolution pills, which move up above it. An
// option in the settings popup, ON by default, kept in this browser's
// localStorage like the fork's other display preferences.
//
// The grid is rebuilt as one markup string; tsBuildCardMediaMarkup is the one
// per-card method, so the pill rides along inside the media box (hooked on the
// INSTANCE). It is an overlay: the grid's sizes stay exactly upstream's.
const TS_FORK_NAMES_KEY = "tsab.fork.cardNames";
const TS_FORK_NAME_FONT_EXTRA = 2;      // px over the badge font; the stylesheet adds the same
const TS_FORK_NAME_CHAR_RATIO = 0.56;   // average glyph width / font size, UI sans

function tsReadStored() {
    try {
        return window.localStorage?.getItem(TS_FORK_NAMES_KEY) !== "0";
    } catch (tsError) {
        return true;
    }
}

function tsWriteStored(tsOn) {
    try {
        window.localStorage?.setItem(TS_FORK_NAMES_KEY, tsOn ? "1" : "0");
    } catch (tsError) {
        // not persisted; the option still works until the page reloads
    }
}

// Filenames differ at the END (clip_00012.mp4), so a name too long for the
// card loses its middle, not its tail.
export function tsForkShortenName(tsName, tsMaxChars) {
    const tsText = String(tsName || "");
    const tsMax = Math.max(8, Math.floor(tsMaxChars));
    if (tsText.length <= tsMax) {
        return tsText;
    }
    const tsTail = Math.ceil((tsMax - 1) * 0.6);
    const tsHead = tsMax - 1 - tsTail;
    return `${tsText.slice(0, tsHead)}\u2026${tsText.slice(-tsTail)}`;
}

// how many characters fit a pill inside a card of these metrics
export function tsForkNameCapacity(tsMetrics) {
    const tsWidth = Number(tsMetrics?.tsCardWidth) || 200;
    const tsInset = Number(tsMetrics?.tsCardInset) || 8;
    const tsPadX = Number(tsMetrics?.tsBadgePadX) || 6;
    const tsFont = (Number(tsMetrics?.tsBadgeFontSize) || 10) + TS_FORK_NAME_FONT_EXTRA;
    return (tsWidth - 2 * tsInset - 2 * tsPadX) / (tsFont * TS_FORK_NAME_CHAR_RATIO);
}

export function tsInstallForkCardNames(tsPanel) {
    const tsRefs = tsPanel?.tsRefs;
    if (!tsRefs?.tsGalleryContent || typeof tsRefs.tsForkSettingsAddRow !== "function" || tsRefs.tsForkCardNames) {
        return;
    }
    let tsOn = tsReadStored();

    const tsBuildCardMediaMarkup = tsPanel.tsBuildCardMediaMarkup;
    tsPanel.tsBuildCardMediaMarkup = function tsForkBuildCardMediaMarkup(tsItem, ...tsRest) {
        const tsMarkup = tsBuildCardMediaMarkup.call(this, tsItem, ...tsRest);
        if (!tsOn) {
            return tsMarkup;
        }
        let tsName = String(tsItem?.filename || "");
        if (this.tsIsWorkflowSection?.()) {
            tsName = tsName.replace(/\.json$/i, "");
        }
        if (!tsName) {
            return tsMarkup;
        }
        // the panel's own cached metrics: the render that calls us just made them
        const tsShown = tsForkShortenName(tsName, tsForkNameCapacity(this.tsGridMetrics));
        return `${tsMarkup}<div class="ts-fork-card-name" title="${this.tsEscapeAttribute(tsName)}">${this.tsEscapeHTML(tsShown)}</div>`;
    };

    const tsToggle = document.createElement("button");
    tsToggle.type = "button";
    tsToggle.className = "ts-toggle-button ts-fork-card-names";
    const tsLabel = document.createElement("span");
    tsToggle.append(tsLabel);

    const tsApply = () => {
        tsToggle.dataset.active = String(tsOn);
        tsToggle.setAttribute("aria-pressed", String(tsOn));
    };
    tsToggle.addEventListener("click", () => {
        tsOn = !tsOn;
        tsWriteStored(tsOn);
        tsApply();
        tsPanel.tsRenderGrid?.(true);
    });

    tsRefs.tsForkSettingsAddRow(tsToggle, (tsT) => {
        tsLabel.textContent = tsT("fork.cardNames", "Show filenames");
        return tsT("fork.cardNamesHint", "Show each file's name on its thumbnail.");
    });
    tsRefs.tsForkCardNames = tsToggle;
    tsApply();
}
