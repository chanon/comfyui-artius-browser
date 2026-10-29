// obvpm fork: the panel's two confirmations -- moving several files to the
// trash, and Rebuild Cache -- in ComfyUI's own dialog instead of the
// browser's window.confirm(), which ComfyUI Desktop does not show (a batch
// delete or a rebuild could never be confirmed there). The browser's dialog
// stays as the fallback where ComfyUI offers none.
//
// Upstream asks with window.confirm() as the very first thing its method does,
// before anything asynchronous. So the method is wrapped on the INSTANCE: the
// question is asked here first, and when the answer is yes upstream's method
// runs with window.confirm answering "yes" for the length of that synchronous
// start -- its own flow (counts, toasts, the rescan) runs unchanged and its
// file is not edited.
import { app } from "/scripts/app.js";

async function tsAsk(tsTitle, tsMessage, tsType) {
    const tsDialog = app?.extensionManager?.dialog;
    if (typeof tsDialog?.confirm === "function") {
        try {
            return (await tsDialog.confirm({ title: tsTitle, message: tsMessage, type: tsType })) === true;
        } catch {
            // the dialog failed to open: ask the browser's way
        }
    }
    return window.confirm(tsMessage);
}

function tsCallConfirmed(tsMethod, tsThis, tsArgs) {
    const tsConfirm = window.confirm;
    window.confirm = () => true;
    try {
        return tsMethod.apply(tsThis, tsArgs);
    } finally {
        window.confirm = tsConfirm;
    }
}

export function tsInstallForkConfirm(tsPanel) {
    if (!tsPanel || tsPanel.tsForkConfirmInstalled) {
        return;
    }
    tsPanel.tsForkConfirmInstalled = true;
    const tsT = (tsKey, tsFallback) => tsPanel.tsT?.(tsKey, tsFallback) || tsFallback;
    const tsTitle = () => tsT("fork.confirm.title", "Artius Browser");

    // upstream asks only for more than one deletable file (one goes at once)
    const tsDeleteAssets = tsPanel.tsDeleteAssets;
    if (typeof tsDeleteAssets === "function") {
        tsPanel.tsDeleteAssets = async function (tsAssets, ...tsRest) {
            const tsCount = (Array.isArray(tsAssets) ? tsAssets : []).filter((tsAsset) => tsAsset?.allow_delete).length;
            if (tsCount > 1) {
                const tsMessage = tsT("confirm.deleteAssets", "Move {count} files to the trash?").replace("{count}", String(tsCount));
                if (!(await tsAsk(tsTitle(), tsMessage, "delete"))) {
                    return undefined;
                }
                return tsCallConfirmed(tsDeleteAssets, this, [tsAssets, ...tsRest]);
            }
            return tsDeleteAssets.call(this, tsAssets, ...tsRest);
        };
    }

    // upstream returns before its question in the Workflows section and while a scan runs
    const tsRequestRebuildCache = tsPanel.tsRequestRebuildCache;
    if (typeof tsRequestRebuildCache === "function") {
        tsPanel.tsRequestRebuildCache = async function (...tsArgs) {
            if (this.tsIsWorkflowSection?.() || this.tsState?.tsScanStatus?.running) {
                return tsRequestRebuildCache.apply(this, tsArgs);
            }
            const tsMessage = tsT("confirm.rebuildCache",
                "Rebuild the browser cache from scratch? This will clear the current cache and start a full rescan.");
            if (!(await tsAsk(tsTitle(), tsMessage, "default"))) {
                return undefined;
            }
            return tsCallConfirmed(tsRequestRebuildCache, this, tsArgs);
        };
    }
}
