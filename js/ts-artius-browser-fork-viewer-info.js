// obvpm fork: a toggle for the viewer's information panel (the column on the
// right of an opened image / video), so the stage can use the full width.
// The state is remembered. The viewer is its own element with its own shadow
// root, so the button and the styles are added THERE, not in the panel.
const TS_FORK_INFO_KEY = "tsab.fork.viewerInfo";

function tsReadShown() {
    try {
        return window.localStorage.getItem(TS_FORK_INFO_KEY) !== "0";
    } catch {
        return true;
    }
}

function tsWriteShown(tsShown) {
    try {
        window.localStorage.setItem(TS_FORK_INFO_KEY, tsShown ? "1" : "0");
    } catch {
        // private mode: the toggle still works for this page
    }
}

const TS_FORK_INFO_CSS = `
    /* obvpm fork: information panel toggle */
    .ts-viewer[data-fork-info="false"] .ts-meta {
        display: none;
    }
    .ts-viewer[data-fork-info="false"] .ts-body {
        grid-template-columns: minmax(0, 1fr);
    }
    .ts-fork-info-toggle[data-active="true"] {
        border-color: var(--ts-accent);
        background: color-mix(in srgb, var(--ts-accent) 18%, var(--ts-bg-2));
    }
`;

export function tsInstallForkViewerInfo(tsPanel) {
    const tsViewer = tsPanel?.tsViewer;
    const tsRoot = tsViewer?.tsRefs?.tsRoot;
    const tsCloseButton = tsViewer?.tsRefs?.tsCloseButton;
    if (!tsRoot || !tsCloseButton || tsViewer.tsRefs.tsForkInfoToggle) {
        return;
    }
    const tsStyle = document.createElement("style");
    tsStyle.textContent = TS_FORK_INFO_CSS;
    tsViewer.shadowRoot.append(tsStyle);

    // right above the panel it controls: the last action before Close
    const tsToggle = document.createElement("button");
    tsToggle.type = "button";
    tsToggle.className = "ts-fork-info-toggle";
    tsCloseButton.before(tsToggle);
    tsViewer.tsRefs.tsForkInfoToggle = tsToggle;

    let tsShown = tsReadShown();
    const tsPaint = () => {
        tsRoot.dataset.forkInfo = String(tsShown);
        tsToggle.dataset.active = String(tsShown);
        tsToggle.setAttribute("aria-pressed", String(tsShown));
        tsToggle.textContent = tsViewer.tsT("fork.viewer.info", "Info");
        tsToggle.title = tsShown
            ? tsViewer.tsT("fork.viewer.info.hide", "Hide the information panel (I)")
            : tsViewer.tsT("fork.viewer.info.show", "Show the information panel (I)");
    };
    const tsSet = (tsNext) => {
        tsShown = Boolean(tsNext);
        tsWriteShown(tsShown);
        tsPaint();
        // the image stage fits itself on a window resize, not on its own size
        window.dispatchEvent(new Event("resize"));
    };
    tsToggle.addEventListener("click", () => tsSet(!tsShown));

    // labels follow the locale, which arrives through the viewer's own render
    const tsRender = tsViewer.tsRender;
    tsViewer.tsRender = function (...tsArgs) {
        const tsResult = tsRender.apply(this, tsArgs);
        tsPaint();
        return tsResult;
    };

    const tsHandleKeydown = tsViewer.tsHandleKeydown;
    tsViewer.tsHandleKeydown = function (tsEvent, ...tsRest) {
        const tsBare = !tsEvent.ctrlKey && !tsEvent.metaKey && !tsEvent.altKey;
        if (this.tsIndex >= 0 && tsBare && (tsEvent.key === "i" || tsEvent.key === "I")
            && !this.tsIsCompareMode()) {
            tsEvent.preventDefault();
            tsSet(!tsShown);
            return undefined;
        }
        return tsHandleKeydown.call(this, tsEvent, ...tsRest);
    };
    tsPaint();
}
