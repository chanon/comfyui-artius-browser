"""obvpm fork: new, changed and deleted files show up without any rescan polling.

One thread per asset root asks Windows to report changes anywhere under it
(ReadDirectoryChangesW with the subtree flag, through ctypes -- no polling and
no extra package). The thread sleeps inside that call until something changes.

Changes are collected per folder and handed to the existing folder rescan
(TSRequestScan with ts_folder) once that folder has settled: no change reported
for TS_WATCH_QUIET_S AND every changed file the same size and modified time
for that long. The second check is needed because Windows reports a growing
file's size only as its write cache is flushed, so a render still being written
can look quiet for seconds; asking the file itself gives its real size. So a
render is indexed once, when it is finished. A folder with other files changing
non-stop is still rescanned after TS_WATCH_MAX_WAIT_S once its files hold
still, and a file that never stops growing after TS_WATCH_GROW_CAP_S. The
folder rescan only processes new or changed files and only removes rows inside
that folder.

Ignored: the browser's own folder (thumbnails, database -- indexing must not
trigger itself), files the browser does not show (.json, .cond, .safetensors,
.tmp, ...), and changes while Autoscan is off. Roots added or removed in the
settings are picked up within TS_WATCH_RESYNC_S.

Not on Windows (or if a root cannot be watched) nothing watches: new files
show up after a generation (upstream's autoscan), a folder click or Rescan.
Nothing polls instead. GET /asset_browser/watcher reports which roots are
watched.
"""
from __future__ import annotations

import asyncio
import logging
import os
import struct
import threading
import time
from pathlib import Path, PurePosixPath
from typing import Any, Callable

from .ts_logging import TSLogInfoIfVerbose, TSLogVerbose

TSLogger = logging.getLogger("TSArtiusBrowser")

TS_WATCH_QUIET_S = 1.5          # a folder must be quiet this long before it is rescanned
TS_WATCH_MAX_WAIT_S = 10.0      # ... unless it has been changing for this long (its files holding still)
TS_WATCH_GROW_CAP_S = 120.0     # a file still growing after this long is indexed anyway
TS_WATCH_TICK_S = 0.25
TS_WATCH_RESYNC_S = 30.0
TS_WATCH_MAX_FOLDERS = 8        # more folders ready at once in one root -> one scan of the root

_FILE_ACTION_ADDED = 1
_FILE_ACTION_REMOVED = 2
_FILE_ACTION_MODIFIED = 3
_FILE_ACTION_RENAMED_OLD_NAME = 4
_FILE_ACTION_RENAMED_NEW_NAME = 5


def _TSLoadKernel32():
    if os.name != "nt":
        return None
    import ctypes
    from ctypes import wintypes

    ts_kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    ts_kernel32.CreateFileW.argtypes = [
        wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.c_void_p,
        wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE,
    ]
    ts_kernel32.CreateFileW.restype = wintypes.HANDLE
    ts_kernel32.ReadDirectoryChangesW.argtypes = [
        wintypes.HANDLE, ctypes.c_void_p, wintypes.DWORD, wintypes.BOOL, wintypes.DWORD,
        ctypes.POINTER(wintypes.DWORD), ctypes.c_void_p, ctypes.c_void_p,
    ]
    ts_kernel32.ReadDirectoryChangesW.restype = wintypes.BOOL
    ts_kernel32.CancelIoEx.argtypes = [wintypes.HANDLE, ctypes.c_void_p]
    ts_kernel32.CancelIoEx.restype = wintypes.BOOL
    ts_kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    ts_kernel32.CloseHandle.restype = wintypes.BOOL
    return ts_kernel32


class _TSRootWatch:
    """One blocking ReadDirectoryChangesW loop over one root's whole tree."""

    _FILE_LIST_DIRECTORY = 0x0001
    _FILE_SHARE_ALL = 0x0001 | 0x0002 | 0x0004
    _OPEN_EXISTING = 3
    _FILE_FLAG_BACKUP_SEMANTICS = 0x02000000
    # names (files + folders), size, last write -- not last access: the
    # indexer reading a file must not look like a change to it
    _NOTIFY_FILTER = 0x0001 | 0x0002 | 0x0008 | 0x0010
    _BUFFER_BYTES = 64 * 1024    # the most a network share will return

    def __init__(self, ts_kernel32, ts_root_id: str, ts_path: Path, ts_on_change: Callable[[str, str | None, int], None]) -> None:
        self.ts_kernel32 = ts_kernel32
        self.ts_root_id = ts_root_id
        self.ts_path = ts_path
        self.ts_on_change = ts_on_change
        self.ts_handle = None
        self.ts_stopped = False
        self.ts_thread: threading.Thread | None = None

    def TSStart(self) -> bool:
        ts_handle = self.ts_kernel32.CreateFileW(
            str(self.ts_path), self._FILE_LIST_DIRECTORY, self._FILE_SHARE_ALL, None,
            self._OPEN_EXISTING, self._FILE_FLAG_BACKUP_SEMANTICS, None,
        )
        if ts_handle is None or ts_handle == -1 or ts_handle == 2 ** (8 * struct.calcsize("P")) - 1:
            return False
        self.ts_handle = ts_handle
        self.ts_thread = threading.Thread(target=self._TSRun, name=f"TSArtiusWatch:{self.ts_root_id}", daemon=True)
        self.ts_thread.start()
        return True

    def TSStop(self) -> None:
        self.ts_stopped = True
        if self.ts_handle is not None:
            # wakes the thread out of its blocking read; it closes the handle
            self.ts_kernel32.CancelIoEx(self.ts_handle, None)

    def _TSRun(self) -> None:
        import ctypes
        from ctypes import wintypes

        ts_buffer = ctypes.create_string_buffer(self._BUFFER_BYTES)
        ts_returned = wintypes.DWORD(0)
        try:
            while not self.ts_stopped:
                ts_ok = self.ts_kernel32.ReadDirectoryChangesW(
                    self.ts_handle, ts_buffer, self._BUFFER_BYTES, True, self._NOTIFY_FILTER,
                    ctypes.byref(ts_returned), None, None,
                )
                if self.ts_stopped:
                    break
                if not ts_ok:
                    TSLogger.warning("Artius Browser (obvpm fork): stopped watching %s (error %s)",
                                     self.ts_path, ctypes.get_last_error())
                    self.ts_on_change(self.ts_root_id, None, 0)     # unknown: rescan the root
                    break
                if ts_returned.value == 0:
                    # more changes than the buffer holds: what changed is unknown
                    self.ts_on_change(self.ts_root_id, None, 0)
                    continue
                ts_raw = ts_buffer.raw[: ts_returned.value]
                ts_offset = 0
                while True:
                    ts_next, ts_action, ts_name_bytes = struct.unpack_from("<III", ts_raw, ts_offset)
                    ts_name = ts_raw[ts_offset + 12: ts_offset + 12 + ts_name_bytes].decode("utf-16-le", "surrogatepass")
                    self.ts_on_change(self.ts_root_id, ts_name.replace("\\", "/"), ts_action)
                    if ts_next == 0:
                        break
                    ts_offset += ts_next
        except Exception:
            TSLogger.exception("Artius Browser (obvpm fork): watcher for %s failed", self.ts_path)
        finally:
            self.ts_kernel32.CloseHandle(self.ts_handle)
            self.ts_handle = None


class TSForkFolderWatcher:
    def __init__(
        self,
        ts_get_roots: Callable[[], list[Any]],
        ts_ignore_paths_for_root: Callable[[Any], Any],
        ts_supported_extensions: Callable[[], set[str]],
        ts_is_autoscan_enabled: Callable[[], bool],
        ts_request_scan: Callable[..., Any],
        ts_get_loop: Callable[[], Any],
    ) -> None:
        self.ts_get_roots = ts_get_roots
        self.ts_ignore_paths_for_root = ts_ignore_paths_for_root
        self.ts_supported_extensions = ts_supported_extensions
        self.ts_is_autoscan_enabled = ts_is_autoscan_enabled
        self.ts_request_scan = ts_request_scan
        self.ts_get_loop = ts_get_loop
        self.ts_kernel32 = _TSLoadKernel32()
        self.ts_lock = threading.Lock()
        self.ts_watches: dict[str, _TSRootWatch] = {}
        self.ts_root_paths: dict[str, Path] = {}
        self.ts_ignored: dict[str, list[str]] = {}       # root id -> ignored folders, relative posix
        self.ts_extensions: set[str] = set()
        # (root, folder) -> {"first": first change, "last": last change reported, "grew": last time a
        # file was found still changing, "files": {path: (size, mtime) or None}}
        self.ts_dirty: dict[tuple[str, str], dict[str, Any]] = {}
        self.ts_started = False

    def TSIsActive(self) -> bool:
        return bool(self.ts_watches) and all(ts_watch.ts_handle is not None for ts_watch in self.ts_watches.values())

    def TSStatus(self) -> dict[str, Any]:
        with self.ts_lock:
            ts_roots = sorted(ts_id for ts_id, ts_watch in self.ts_watches.items() if ts_watch.ts_handle is not None)
        return {"active": self.TSIsActive(), "roots": ts_roots,
                "quiet_seconds": TS_WATCH_QUIET_S, "max_wait_seconds": TS_WATCH_MAX_WAIT_S}

    def TSStart(self) -> None:
        if self.ts_started or self.ts_kernel32 is None:
            return
        self.ts_started = True
        self._TSResync()
        threading.Thread(target=self._TSDispatchLoop, name="TSArtiusWatchDispatch", daemon=True).start()

    # ---- which roots are watched ----
    def _TSResync(self) -> None:
        try:
            ts_roots = {ts_root.ts_root_id: ts_root for ts_root in self.ts_get_roots()}
            self.ts_extensions = {str(ts_ext).lower() for ts_ext in self.ts_supported_extensions()}
        except Exception:
            TSLogger.debug("Artius Browser (obvpm fork): watcher root list failed", exc_info=True)
            return
        for ts_root_id, ts_watch in list(self.ts_watches.items()):
            ts_root = ts_roots.get(ts_root_id)
            if ts_root is None or ts_root.ts_path.resolve() != ts_watch.ts_path or ts_watch.ts_handle is None:
                ts_watch.TSStop()
                with self.ts_lock:
                    self.ts_watches.pop(ts_root_id, None)
        for ts_root_id, ts_root in ts_roots.items():
            if ts_root_id in self.ts_watches:
                continue
            ts_path = ts_root.ts_path.resolve()
            if not ts_path.is_dir():
                continue
            ts_ignored = []
            for ts_ignored_path in self.ts_ignore_paths_for_root(ts_root):
                try:
                    ts_ignored.append(Path(ts_ignored_path).resolve().relative_to(ts_path).as_posix())
                except ValueError:
                    continue
            self.ts_ignored[ts_root_id] = ts_ignored
            self.ts_root_paths[ts_root_id] = ts_path
            ts_watch = _TSRootWatch(self.ts_kernel32, ts_root_id, ts_path, self._TSOnChange)
            if ts_watch.TSStart():
                with self.ts_lock:
                    self.ts_watches[ts_root_id] = ts_watch
                TSLogInfoIfVerbose("Artius Browser (obvpm fork): watching %s for new files", ts_path)
            else:
                TSLogger.warning("Artius Browser (obvpm fork): cannot watch %s for new files; use Rescan or click the folder", ts_path)

    # ---- one change reported by a root's thread ----
    def _TSOnChange(self, ts_root_id: str, ts_relative: str | None, ts_action: int) -> None:
        if ts_relative is None:
            self._TSMarkDirty(ts_root_id, "", None)
            return
        for ts_ignored in self.ts_ignored.get(ts_root_id, ()):
            if ts_relative == ts_ignored or ts_relative.startswith(ts_ignored + "/"):
                return
        ts_pure = PurePosixPath(ts_relative)
        ts_parent = "" if str(ts_pure.parent) == "." else ts_pure.parent.as_posix()
        if ts_pure.suffix.lower() in self.ts_extensions:
            ts_root_path = self.ts_root_paths.get(ts_root_id)
            self._TSMarkDirty(ts_root_id, ts_parent, None if ts_root_path is None else ts_root_path / ts_relative)
            return
        # not a file the browser shows -- but it may be a folder that was
        # created or renamed (its files arrive with it); a folder's own
        # "modified" just echoes changes inside it, already reported
        if ts_action in (_FILE_ACTION_ADDED, _FILE_ACTION_RENAMED_NEW_NAME):
            ts_root_path = self.ts_root_paths.get(ts_root_id)
            if ts_root_path is not None and (ts_root_path / ts_relative).is_dir():
                self._TSMarkDirty(ts_root_id, ts_parent, None)

    @staticmethod
    def _TSFileState(ts_path: Path):
        try:
            ts_stat = ts_path.stat()
        except OSError:
            return None                  # deleted (or not there yet)
        return (ts_stat.st_size, ts_stat.st_mtime_ns)

    def _TSMarkDirty(self, ts_root_id: str, ts_folder: str, ts_path: Path | None) -> None:
        ts_now = time.monotonic()
        ts_state = self._TSFileState(ts_path) if ts_path is not None else None
        with self.ts_lock:
            ts_entry = self.ts_dirty.setdefault((ts_root_id, ts_folder), {"first": ts_now, "last": ts_now, "grew": 0.0, "files": {}})
            ts_entry["last"] = ts_now
            if ts_path is not None:
                ts_entry["files"][ts_path] = ts_state

    # ---- the debounce: rescan a folder once it has settled ----
    def _TSDispatchLoop(self) -> None:
        ts_next_resync = time.monotonic() + TS_WATCH_RESYNC_S
        while True:
            time.sleep(TS_WATCH_TICK_S)
            ts_now = time.monotonic()
            if ts_now >= ts_next_resync:
                ts_next_resync = ts_now + TS_WATCH_RESYNC_S
                self._TSResync()
            with self.ts_lock:
                ts_due = [
                    (ts_key, ts_entry["last"], dict(ts_entry["files"]))
                    for ts_key, ts_entry in self.ts_dirty.items()
                    if (ts_now - ts_entry["last"] >= TS_WATCH_QUIET_S or ts_now - ts_entry["first"] >= TS_WATCH_MAX_WAIT_S)
                    and ts_now - ts_entry["grew"] >= TS_WATCH_QUIET_S
                ]
            ts_ready = []
            for ts_key, ts_last_seen, ts_files in ts_due:
                # ask each changed file for its real size / modified time
                # (outside the lock: it touches the disk)
                ts_current = {ts_path: self._TSFileState(ts_path) for ts_path in ts_files}
                with self.ts_lock:
                    ts_entry = self.ts_dirty.get(ts_key)
                    if ts_entry is None:
                        continue
                    if ts_entry["last"] != ts_last_seen and ts_now - ts_entry["first"] < TS_WATCH_MAX_WAIT_S:
                        continue             # more changes came in meanwhile: wait again
                    if ts_current != ts_files and ts_now - ts_entry["first"] < TS_WATCH_GROW_CAP_S:
                        # still being written: remember what it is now, wait for it to hold still
                        ts_entry["files"].update(ts_current)
                        ts_entry["grew"] = ts_now
                        continue
                    self.ts_dirty.pop(ts_key, None)
                    ts_ready.append(ts_key)
            if ts_ready:
                try:
                    self._TSDispatch(ts_ready)
                except Exception:
                    TSLogger.debug("Artius Browser (obvpm fork): watcher rescan request failed", exc_info=True)

    def _TSDispatch(self, ts_ready: list[tuple[str, str]]) -> None:
        if not self.ts_is_autoscan_enabled():
            TSLogVerbose("fork.watcher.skipped", reason="autoscan_disabled", folders=len(ts_ready))
            return
        ts_loop = self.ts_get_loop()
        if ts_loop is None:
            return
        ts_by_root: dict[str, list[str]] = {}
        for ts_root_id, ts_folder in ts_ready:
            ts_by_root.setdefault(ts_root_id, []).append(ts_folder)
        for ts_root_id, ts_folders in ts_by_root.items():
            # a folder rescan covers its subfolders: keep only the outermost
            ts_folders = sorted(set(ts_folders))
            ts_kept: list[str] = []
            for ts_folder in ts_folders:
                if not any(ts_outer == "" or ts_folder == ts_outer or ts_folder.startswith(ts_outer + "/") for ts_outer in ts_kept):
                    ts_kept.append(ts_folder)
            if len(ts_kept) > TS_WATCH_MAX_FOLDERS:
                ts_kept = [""]
            for ts_folder in ts_kept:
                TSLogVerbose("fork.watcher.rescan", root_id=ts_root_id, folder=ts_folder)
                asyncio.run_coroutine_threadsafe(
                    self.ts_request_scan(ts_root_id=ts_root_id, ts_folder=ts_folder), ts_loop
                )
