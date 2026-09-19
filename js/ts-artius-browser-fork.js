// obvpm fork: the one entry point the panel calls. Everything the fork adds
// to the panel is installed from here, so upstream's panel file carries one
// import and one call however much the fork grows.
import { tsInstallForkSettings } from "./ts-artius-browser-fork-settings.js";
import { tsInstallForkSelectionBar } from "./ts-artius-browser-fork-selection-bar.js";

export function tsInstallFork(tsPanel) {
    for (const tsInstall of [tsInstallForkSettings, tsInstallForkSelectionBar]) {
        try {
            tsInstall(tsPanel);
        } catch (tsError) {
            // a fork feature that fails must not take the browser down with it
            console.warn("Artius Browser (obvpm fork): install failed", tsInstall.name, tsError);
        }
    }
}
