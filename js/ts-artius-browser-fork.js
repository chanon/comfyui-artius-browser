// obvpm fork: the one entry point the panel calls. Everything the fork adds
// to the panel is installed from here, so upstream's panel file carries one
// import and one call however much the fork grows.
import { tsInstallForkSettings } from "./ts-artius-browser-fork-settings.js";
import { tsInstallForkSelectionBar } from "./ts-artius-browser-fork-selection-bar.js";
import { tsInstallForkAssetsOnly } from "./ts-artius-browser-fork-assets-only.js";
import { tsInstallForkToolbar } from "./ts-artius-browser-fork-toolbar.js";
import { tsInstallForkRecurse } from "./ts-artius-browser-fork-recurse.js";
import { tsInstallForkViewerInfo } from "./ts-artius-browser-fork-viewer-info.js";
import { tsInstallForkVideoSize } from "./ts-artius-browser-fork-video-size.js";
import { tsInstallForkVideoCompare } from "./ts-artius-browser-fork-video-compare.js";
import { tsInstallForkCardNames } from "./ts-artius-browser-fork-card-names.js";
import { tsInstallForkCardAlign } from "./ts-artius-browser-fork-card-align.js";
import { tsInstallForkSortDates } from "./ts-artius-browser-fork-sort-dates.js";
import { tsInstallForkHide3D } from "./ts-artius-browser-fork-hide-3d.js";
import { tsInstallForkRootToggle } from "./ts-artius-browser-fork-root-toggle.js";
import { tsInstallForkRootMemory } from "./ts-artius-browser-fork-root-memory.js";
import { tsInstallForkModeSelect } from "./ts-artius-browser-fork-mode-select.js";
import { tsInstallForkNarrowToolbar } from "./ts-artius-browser-fork-narrow-toolbar.js";

export function tsInstallFork(tsPanel) {
    for (const tsInstall of [tsInstallForkToolbar, tsInstallForkNarrowToolbar, tsInstallForkModeSelect, tsInstallForkRecurse, tsInstallForkSettings, tsInstallForkSelectionBar,
        tsInstallForkAssetsOnly, tsInstallForkHide3D, tsInstallForkRootToggle, tsInstallForkRootMemory,
        tsInstallForkViewerInfo, tsInstallForkVideoSize, tsInstallForkVideoCompare,
        tsInstallForkCardNames, tsInstallForkCardAlign, tsInstallForkSortDates]) {
        try {
            tsInstall(tsPanel);
        } catch (tsError) {
            // a fork feature that fails must not take the browser down with it
            console.warn("Artius Browser (obvpm fork): install failed", tsInstall.name, tsError);
        }
    }
}
