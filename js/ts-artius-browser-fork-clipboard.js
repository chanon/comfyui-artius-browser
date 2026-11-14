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

const TS_FORK_CLIPBOARD_EVENTS = ["copy", "cut", "paste"];

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
    for (const tsType of TS_FORK_CLIPBOARD_EVENTS) {
        tsRoot.addEventListener(tsType, (tsEvent) => {
            const tsPath = typeof tsEvent.composedPath === "function" ? tsEvent.composedPath() : [];
            if (tsIsTextBox(tsPath[0] || tsEvent.target)) {
                tsEvent.stopPropagation();
            }
        });
    }
}
