// obvpm fork: in a narrow panel the folder tree sits over the grid, and the
// line between them can be dragged to make the tree taller or shorter.
//
// Upstream's width handle is the same element, moved by the CSS block "tree
// over the grid": its row is shown there and this module takes its drag while
// the panel is stacked. In a wide panel the drag stays upstream's, sideways.
// Whether the panel is stacked is read from that block (--ts-fork-stacked), so
// the width it happens at is written in one place only.
//
// The capture listener runs before upstream's on the same element, and stops
// it, because upstream's drag is a closure with no way to hook it.
//
// Kept in this browser's localStorage, like the fork's other choices: the
// pack's settings file accepts a fixed list of keys.

const TS_FORK_TREE_HEIGHT_KEY = "tsab.fork.treeHeight";
const TS_FORK_TREE_MIN_HEIGHT = 60;
// what the drag leaves for the grid (the handle's own row included); the CSS
// keeps the same room when the panel itself gets shorter later
const TS_FORK_TREE_GRID_ROOM = 124;

function tsReadStored() {
    try {
        const tsValue = Math.round(Number(window.localStorage?.getItem(TS_FORK_TREE_HEIGHT_KEY)));
        return tsValue >= TS_FORK_TREE_MIN_HEIGHT ? tsValue : null;
    } catch (tsError) {
        return null;
    }
}

function tsWriteStored(tsHeight) {
    try {
        window.localStorage?.setItem(TS_FORK_TREE_HEIGHT_KEY, String(tsHeight));
    } catch (tsError) {
        // not kept; still works until the page reloads
    }
}

export function tsInstallForkTreeHeight(tsPanel) {
    const { tsBody, tsTreePanel, tsTreeResizer } = tsPanel.tsRefs;
    if (!tsBody || !tsTreePanel || !tsTreeResizer) {
        return;
    }

    let tsHeight = tsReadStored();
    const tsApply = () => {
        if (tsHeight !== null) {
            tsBody.style.setProperty("--ts-fork-tree-height", `${tsHeight}px`);
        }
    };
    tsApply();

    const tsIsStacked = () => getComputedStyle(tsBody).getPropertyValue("--ts-fork-stacked").trim() === "1";

    tsTreeResizer.addEventListener("pointerdown", (tsDown) => {
        if (!tsIsStacked()) {
            return;
        }
        tsDown.preventDefault();
        tsDown.stopImmediatePropagation();
        const tsPointerId = tsDown.pointerId;
        const tsStartY = tsDown.clientY;
        // from what shows: a short tree can be smaller than the height kept
        const tsStartHeight = tsTreePanel.getBoundingClientRect().height;
        const tsMaxHeight = Math.max(TS_FORK_TREE_MIN_HEIGHT, tsBody.getBoundingClientRect().height - TS_FORK_TREE_GRID_ROOM);

        const tsOnMove = (tsEvent) => {
            if (tsEvent.pointerId !== tsPointerId) {
                return;
            }
            const tsWanted = tsStartHeight + tsEvent.clientY - tsStartY;
            tsHeight = Math.round(Math.max(TS_FORK_TREE_MIN_HEIGHT, Math.min(tsMaxHeight, tsWanted)));
            tsApply();
        };
        const tsOnEnd = (tsEvent) => {
            if (tsEvent.pointerId !== tsPointerId) {
                return;
            }
            tsTreeResizer.dataset.dragging = "false";
            tsTreeResizer.releasePointerCapture?.(tsPointerId);
            tsTreeResizer.removeEventListener("pointermove", tsOnMove);
            tsTreeResizer.removeEventListener("pointerup", tsOnEnd);
            tsTreeResizer.removeEventListener("pointercancel", tsOnEnd);
            if (tsHeight !== null) {
                tsWriteStored(tsHeight);
            }
        };
        tsTreeResizer.dataset.dragging = "true";
        tsTreeResizer.setPointerCapture?.(tsPointerId);
        tsTreeResizer.addEventListener("pointermove", tsOnMove);
        tsTreeResizer.addEventListener("pointerup", tsOnEnd);
        tsTreeResizer.addEventListener("pointercancel", tsOnEnd);
    }, { capture: true });
}
