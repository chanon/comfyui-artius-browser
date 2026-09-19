// obvpm fork: a thumbnail that does not fill its square box (a landscape image
// or video) is centred in the FREE part of the card -- between the bottom of
// the hover action bar at the top and the top of the pill row at the bottom --
// instead of in the middle of the box, where the pills sit on top of it.
//
// The preview <img> fills the box with object-fit: contain, so the picture is
// moved with object-position (a length = the picture's top edge), clamped so it
// can never leave the box. The numbers are the grid's own metrics; the pill
// row's height follows the fork's filename pill (see its CSS block) when shown.
// One deliberate difference: the pill's bottom margin counts as HALF the inset
// here although the stylesheet now uses more -- the pictures' positions were
// settled first and are kept where they were.
const TS_FORK_NAME_FONT_EXTRA = 2;      // as in the filename pill
const TS_FORK_NAME_LINE = 1.2;
const TS_FORK_BADGE_LINE = 1.1;         // upstream's .ts-card-badge line-height

// Top edge, in px from the box top, for a picture of this aspect; null when
// there is nothing to move (it fills the height, or the sizes are unknown).
export function tsForkThumbTop(tsMetrics, tsWidth, tsHeight, tsNamesShown) {
    const tsBoxWidth = Number(tsMetrics?.tsCardWidth);
    const tsBoxHeight = Number(tsMetrics?.tsCardPreviewHeight);
    const tsW = Number(tsWidth);
    const tsH = Number(tsHeight);
    if (!(tsBoxWidth > 0) || !(tsBoxHeight > 0) || !(tsW > 0) || !(tsH > 0)) {
        return null;
    }
    const tsShownHeight = Math.min(tsBoxHeight, tsBoxWidth * (tsH / tsW));
    const tsFree = tsBoxHeight - tsShownHeight;
    if (tsFree < 1) {
        return null;
    }
    const tsInset = Number(tsMetrics.tsCardInset) || 0;
    const tsPadY = Number(tsMetrics.tsBadgePadY) || 0;
    const tsBadgeFont = Number(tsMetrics.tsBadgeFontSize) || 0;
    const tsBadgeRow = tsBadgeFont * TS_FORK_BADGE_LINE + 2 * tsPadY;
    // bottom of the hover bar / top of the pill row, from the box's edges
    const tsTopBar = tsInset + (Number(tsMetrics.tsActionSize) || 0);
    const tsPills = tsNamesShown
        ? tsInset * 0.5 + (tsBadgeFont + TS_FORK_NAME_FONT_EXTRA) * TS_FORK_NAME_LINE + 2 * tsPadY
            + (Number(tsMetrics.tsActionGap) || 0) * 0.5 + tsBadgeRow
        : tsInset + tsBadgeRow;
    const tsCentre = (tsTopBar + (tsBoxHeight - tsPills)) / 2;
    return Math.max(0, Math.min(tsFree, tsCentre - tsShownHeight / 2));
}

export function tsInstallForkCardAlign(tsPanel) {
    if (typeof tsPanel?.tsBuildCardMediaMarkup !== "function" || tsPanel.tsForkCardAlignInstalled) {
        return;
    }
    tsPanel.tsForkCardAlignInstalled = true;
    const tsBuildCardMediaMarkup = tsPanel.tsBuildCardMediaMarkup;
    tsPanel.tsBuildCardMediaMarkup = function tsForkAlignCardMediaMarkup(tsItem, ...tsRest) {
        const tsMarkup = tsBuildCardMediaMarkup.call(this, tsItem, ...tsRest);
        // workflow previews are cropped to fill (object-fit: cover): nothing to centre
        if (typeof tsMarkup !== "string" || !tsMarkup.startsWith("<img") || this.tsIsWorkflowSection?.()) {
            return tsMarkup;
        }
        const tsNamesShown = this.tsRefs?.tsForkCardNames?.dataset.active === "true";
        const tsTop = tsForkThumbTop(this.tsGridMetrics, tsItem?.width, tsItem?.height, tsNamesShown);
        if (tsTop === null) {
            return tsMarkup;
        }
        return `<img style="object-position:50% ${tsTop.toFixed(1)}px"${tsMarkup.slice(4)}`;
    };
}
