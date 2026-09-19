export const tsProjectSettings = Object.freeze({
    extensionId: "timesaver.artius.browser",
    sidebarId: "timesaver-artius-browser",
    sidebarIcon: "tsArtiusSidebarIcon",
    title: "Artius Browser",
    // obvpm fork: appended to the PANEL's title only (not the sidebar tab,
    // not the locale files) so a glance says which build is running.
    forkLabel: "(obvpm fork)",
    label: "Browser",
    tooltip: "Timesaver Artius Browser",
    defaultLocale: "en",
});

export const tsBrowserRuntimeSettings = Object.freeze({
    initialRescanDelayMs: 600,
    initialRescanFreshWindowMs: 60000,
    executionRescanDelayMs: 1200,
    executionRescanMaxDeferralMs: 5000,
    executionRescanIdleRetryMs: 250,
    executionRescanRootId: "output",
    // How long one tab's post-generation rescan claim suppresses the
    // others. Comfortably longer than a scan of a large library takes to
    // start, short enough that a tab closed mid-generation cannot mute
    // the next one.
    executionRescanClaimWindowMs: 8000,
    enableConsoleDebug: false,
});

export const tsApiSettings = Object.freeze({
    routeBase: "/asset_browser",
    assetDragMime: "application/x-timesaver-artius-asset",
    nativeWorkflowTargets: {
        image: { tsNodeType: "LoadImage", tsWidgetNames: ["image"] },
        video: { tsNodeType: "LoadVideo", tsWidgetNames: ["file", "video"] },
        audio: { tsNodeType: "LoadAudio", tsWidgetNames: ["audio"] },
        "3d": { tsNodeType: "Load3D", tsWidgetNames: ["model_file"] },
    },
    fallbackWorkflowTargets: {},
    // Node types PREFERRED over the native ComfyUI loader when the pack that
    // publishes them is installed in this ComfyUI. Each list is tried in order
    // and the first entry whose node type is registered wins; with none of them
    // installed the native target above is used and nothing changes.
    //
    // tsValueKind "path" means the node takes the asset's absolute path as it
    // sits on the ComfyUI machine, so the asset is NOT copied into input/.
    // tsHiddenWidgetStash / tsRefreshHook are optional surfaces such a node may
    // expose: a stash of widgets it removed from node.widgets to render its own
    // interface, and a hook that re-reads the persisted value. Both are read
    // through optional access - a node without them still gets its value.
    preferredWorkflowTargets: {
        video: [
            {
                tsNodeType: "TS_VideoLoader",
                tsWidgetNames: ["source_path"],
                tsValueKind: "path",
                tsHiddenWidgetStash: "_tsHiddenWidgets",
                tsRefreshHook: "_tsVideoLoaderRehydrate",
            },
        ],
    },
});

export const tsPanelSettings = Object.freeze({
    typeOrder: ["image", "video", "audio", "3d"],
    defaultLimit: 60,
    defaultRootId: "all",
    defaultMode: "flat",
    defaultAutoscan: true,
    defaultSort: {
        key: "created_at",
        direction: "desc",
    },
    defaultExpandedFolders: ["root:output", "root:input"],
    debounceMs: {
        search: 220,
        realtimeRefresh: 350,
        filterChip: 120,
    },
    responseCache: {
        ttlMs: 30000,
        capacity: 10,
    },
    threeDThumbnails: {
        concurrency: 1,
        visibleLimit: 4,
        captureSize: 480,
        warmFrames: 2,
        backgroundPageSize: 8,
        cacheCapacity: 64,
    },
    previewSizeRange: {
        min: 96,
        max: 320,
        step: 8,
        default: 120,
    },
    gridLayout: {
        spacing: 10,
    },
    gridOverscanRows: 1,
    cardChromeScale: {
        insetMin: 5,
        insetMax: 9,
        actionSizeMin: 16,
        actionSizeMax: 24,
        actionRadiusMin: 4,
        actionRadiusMax: 6,
        actionFontMin: 8,
        actionFontMax: 10,
        actionGapMin: 3,
        actionGapMax: 5,
        badgeFontMin: 8,
        badgeFontMax: 10,
        badgePadYMin: 2,
        badgePadYMax: 4,
        badgePadXMin: 5,
        badgePadXMax: 8,
        badgeRadiusMin: 5,
        badgeRadiusMax: 7,
        overlayPadXMin: 10,
        overlayPadXMax: 14,
        overlayPadBottomMin: 10,
        overlayPadBottomMax: 14,
        overlayTopMin: 28,
        overlayTopMax: 40,
        overlayTitleMin: 12,
        overlayTitleMax: 14,
        overlayMetaMin: 10,
        overlayMetaMax: 12,
        cardRadiusMin: 10,
        cardRadiusMax: 14,
    },
});

export const tsViewerSettings = Object.freeze({
    imageZoom: {
        min: 1,
        max: 8,
        stepIn: 1.14,
        stepOut: 1 / 1.14,
        // Keyboard pan step, in screen pixels. A wheel-free zoom is useless if
        // the only way to reach the corner of the image is the mouse.
        panStep: 60,
        panStepFast: 240,
    },
    pagination: {
        prefetchThreshold: 6,
    },
    audio: {
        maxWidth: 1600,
        waveformMaxHeight: 360,
    },
});

