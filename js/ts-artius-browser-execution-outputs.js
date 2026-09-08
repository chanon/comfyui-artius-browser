// Which files a prompt just wrote, taken from ComfyUI's own event stream.
//
// The post-generation autoscan used to ask the server to walk the whole output
// root to find the one or two files a prompt produced. ComfyUI already says
// what it wrote: every node that saves something emits an "executed" event
// whose `output` carries {filename, subfolder, type} entries, under whatever
// key that node chose ("images", "gifs", "audio", ...). Collecting those turns
// a full walk into a handful of stat() calls.
//
// Only "output" entries are of interest: "temp" and "input" are not the root
// the autoscan covers, so naming them would ask the backend to index files it
// deliberately does not index.

export const TS_MAX_TRACKED_EXECUTION_FILES = 64;

function tsIsSafeRelativePath(tsPath) {
    // Defence in depth. The backend resolves and re-checks containment, but a
    // path that cannot possibly be legitimate should not be sent at all.
    if (!tsPath || tsPath.startsWith("/") || tsPath.startsWith("\\")) {
        return false;
    }
    if (/^[a-zA-Z]:/.test(tsPath)) {
        return false;
    }
    return !tsPath.split("/").some((tsSegment) => tsSegment === ".." || tsSegment === ".");
}

export function tsExtractExecutedOutputPaths(tsOutput) {
    if (!tsOutput || typeof tsOutput !== "object") {
        return [];
    }
    const tsPaths = [];
    const tsSeen = new Set();
    for (const tsValue of Object.values(tsOutput)) {
        if (!Array.isArray(tsValue)) {
            continue;
        }
        for (const tsEntry of tsValue) {
            if (!tsEntry || typeof tsEntry !== "object") {
                continue;
            }
            const tsFilename = String(tsEntry.filename || "").trim();
            if (!tsFilename || String(tsEntry.type || "output") !== "output") {
                continue;
            }
            // Only the TRAILING separator is trimmed. Stripping a leading one
            // would turn an absolute "/etc" into the relative "etc" and send a
            // path the caller never meant; it has to fail the check below.
            const tsSubfolder = String(tsEntry.subfolder || "").replaceAll("\\", "/").replace(/\/+$/, "");
            const tsPath = tsSubfolder ? `${tsSubfolder}/${tsFilename}` : tsFilename;
            if (!tsIsSafeRelativePath(tsPath) || tsSeen.has(tsPath)) {
                continue;
            }
            tsSeen.add(tsPath);
            tsPaths.push(tsPath);
        }
    }
    return tsPaths;
}
