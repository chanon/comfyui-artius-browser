// obvpm fork: Ctrl+C / Ctrl+X / Ctrl+V work in the panel's text boxes (the
// search field, the Multiple names box, the filter inputs).
//
// ComfyUI listens for copy (and paste) on the document to copy and paste
// nodes, and leaves the event alone only when it comes from a text field. The
// panel lives in a shadow root, so by the time the event reaches the document
// its target is the panel element itself, not the text box: ComfyUI took the
// copy over (it put the graph's nodes on the clipboard and cancelled the
// copy), so copying text out of the search field or the names box copied
// nothing. A paste could likewise drop a copied image or nodes on the canvas.
//
// The clipboard events of the panel's text boxes are stopped at its shadow
// root, before they reach the document. Stopped, not cancelled: the browser
// still copies, cuts and pastes the text. Anything outside the panel's text
// boxes reaches ComfyUI as before.
//
// Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z had the same problem: they undid the
// WORKFLOW as well as the text. ComfyUI's undo is a keydown listener on window
// in the capture phase -- it runs before the panel sees the key, so stopping
// the event cannot help. It leaves text fields alone by looking at
// document.activeElement, which for a text box in a shadow root is the shadow
// host (the panel), and then, one animation frame later, calls the active
// workflow's changeTracker.undoRedo(event). So: our own capture listener marks
// the Ctrl / Cmd key presses that come from a text box inside a shadow root,
// and undoRedo (on the ChangeTracker prototype, wrapped the first time such a
// key comes) answers "handled" for those without touching the workflow. The
// browser's own undo of the text, the key's default action, is untouched.
//
// The other way round: the browser keeps ONE undo history for the whole page,
// and Ctrl+Z pressed outside any text box (on the canvas) also ran it -- it took
// back the last edit made in a text box (the Multiple box), put the cursor
// there, and every further Ctrl+Z then went to the box instead of the
// workflow. An undo / redo key pressed outside a text box therefore has its
// default action cancelled; ComfyUI's undo of the workflow does not look at
// that and runs as before. Keys inside any text box (ComfyUI's own node text
// fields too) keep the browser's undo.

const TS_FORK_CLIPBOARD_EVENTS = ["copy", "cut", "paste"];
const tsTextBoxKeys = new WeakSet();
let tsUndoGuardInstalled = false;

function tsWrapUndoRedo() {
    const tsTracker = window.app?.extensionManager?.workflow?.activeWorkflow?.changeTracker;
    const tsProto = tsTracker ? Object.getPrototypeOf(tsTracker) : null;
    if (!tsProto || typeof tsProto.undoRedo !== "function" || tsProto.undoRedo.tsForkTextBoxGuard) {
        return;
    }
    const tsUndoRedo = tsProto.undoRedo;
    const tsGuarded = function (tsEvent, ...tsRest) {
        if (tsEvent && tsTextBoxKeys.has(tsEvent)) {
            return Promise.resolve(true);
        }
        return tsUndoRedo.call(this, tsEvent, ...tsRest);
    };
    tsGuarded.tsForkTextBoxGuard = true;
    tsProto.undoRedo = tsGuarded;
}

function tsInstallUndoGuard() {
    if (tsUndoGuardInstalled) {
        return;
    }
    tsUndoGuardInstalled = true;
    window.addEventListener("keydown", (tsEvent) => {
        if (!(tsEvent.ctrlKey || tsEvent.metaKey)) {
            return;
        }
        const tsPath = typeof tsEvent.composedPath === "function" ? tsEvent.composedPath() : [];
        const tsTarget = tsPath[0];
        if (tsIsTextBox(tsTarget)) {
            // a text box ComfyUI's own check cannot see: one inside a shadow root
            if (tsTarget.getRootNode?.() instanceof ShadowRoot) {
                tsTextBoxKeys.add(tsEvent);
                tsWrapUndoRedo();
            }
            return;
        }
        // outside any text box: no page-wide browser undo (ComfyUI's own
        // shortcut test: Ctrl/Cmd + Z, Shift+Z or Y, no Alt)
        const tsKey = String(tsEvent.key || "").toUpperCase();
        if (!tsEvent.altKey && (tsKey === "Z" || (tsKey === "Y" && !tsEvent.shiftKey))) {
            tsEvent.preventDefault();
        }
    }, true);
}

function tsIsTextBox(tsElement) {
    if (!tsElement || typeof tsElement !== "object") {
        return false;
    }
    if (tsElement.isContentEditable) {
        return true;
    }
    const tsTag = String(tsElement.tagName || "").toUpperCase();
    if (tsTag === "TEXTAREA") {
        return true;
    }
    if (tsTag !== "INPUT") {
        return false;
    }
    // text-like inputs only: a checkbox or a range has no text to copy
    return ["text", "search", "number", "url", "email", "tel", "password", "date", ""].includes(String(tsElement.type || "").toLowerCase());
}

export function tsInstallForkClipboard(tsPanel) {
    const tsRoot = tsPanel?.shadowRoot;
    if (!tsRoot || tsPanel.tsForkClipboardInstalled) {
        return;
    }
    tsPanel.tsForkClipboardInstalled = true;
    tsInstallUndoGuard();
    for (const tsType of TS_FORK_CLIPBOARD_EVENTS) {
        tsRoot.addEventListener(tsType, (tsEvent) => {
            const tsPath = typeof tsEvent.composedPath === "function" ? tsEvent.composedPath() : [];
            if (tsIsTextBox(tsPath[0] || tsEvent.target)) {
                tsEvent.stopPropagation();
            }
        });
    }
}
