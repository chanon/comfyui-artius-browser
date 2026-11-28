"""obvpm fork: on Windows, files are sent in chunks instead of with TransmitFile.

aiohttp's FileResponse hands the file to loop.sendfile, which on Windows is the
TransmitFile call. Client editions of Windows (10, 11 -- not Server) run at
most TWO TransmitFile operations at a time, system-wide; the rest wait in a
queue. A <video> element never finishes its download on purpose: Chrome reads
15-20 s ahead and then stops reading the connection, so that transfer stays
in progress, holding its slot. Two clips that had buffered enough held both
slots, and every other file this server sent waited behind them: in a
comparison of four or more long clips one clip stopped loading after a second
or two, and the whole group sat in "Syncing clips..." (thumbnails asked for
meanwhile waited too).

TSForkFileResponse sends the file the way aiohttp itself does without
sendfile (AIOHTTP_NOSENDFILE, or compression): read in chunks on a worker
thread and written to the connection, waiting while the browser is not
reading. A paused clip then pauses only its own response. Ranges, ETag, 304
and 416 are FileResponse's own, unchanged. Elsewhere (or with an aiohttp that
has no such fallback) it is a plain FileResponse.
"""
from __future__ import annotations

import os

from aiohttp import web as TSWeb


class _TSChunkedFileResponse(TSWeb.FileResponse):
    async def _sendfile(self, request, fobj, offset, count):
        # FileResponse._sendfile's own branch for NOSENDFILE / compression
        ts_writer = await TSWeb.StreamResponse.prepare(self, request)
        return await self._sendfile_fallback(ts_writer, fobj, offset, count)


TS_FORK_CHUNKED_FILES = (
    os.name == "nt"
    and callable(getattr(TSWeb.FileResponse, "_sendfile", None))
    and callable(getattr(TSWeb.FileResponse, "_sendfile_fallback", None))
)


def TSForkFileResponse(ts_path, **ts_kwargs) -> TSWeb.FileResponse:
    if TS_FORK_CHUNKED_FILES:
        return _TSChunkedFileResponse(ts_path, **ts_kwargs)
    return TSWeb.FileResponse(ts_path, **ts_kwargs)
