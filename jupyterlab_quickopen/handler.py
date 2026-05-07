import os
import time
from fnmatch import fnmatch

import pathspec
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import ensure_async
from tornado import web
from tornado.escape import json_encode


GITIGNORE_FILENAME = ".gitignore"


class QuickOpenHandler(APIHandler):
    @property
    def contents_manager(self):
        """Currently configured jupyter server ContentsManager."""
        return self.settings["contents_manager"]

    @property
    def root_dir(self) -> str:
        """Root directory to scan."""
        return self.contents_manager.root_dir

    async def should_hide(self, entry: os.DirEntry, excludes: set[str]) -> bool:
        """Decides if a file or directory should be hidden from the search results based on
        the `allow_hidden` and `hide_globs` properties of the ContentsManager, as well as a
        set of exclude patterns included in the client request.

        Parameters
        ----------
        entry: DirEntry
            From os.scandir
        excludes: set of str
            Exclude patterns

        Returns
        -------
        bool
        """
        relpath = os.path.relpath(entry.path)

        return (
            any(fnmatch(entry.name, glob) for glob in excludes)
            or not self.contents_manager.should_list(entry.name)
            or (
                await ensure_async(self.contents_manager.is_hidden(relpath))
                and not self.contents_manager.allow_hidden
            )
        )

    def _load_gitignore(self, directory: str) -> pathspec.PathSpec | None:
        """Read a .gitignore file in the given directory and return a PathSpec.

        Returns None if no .gitignore exists or the file cannot be read.
        """
        gitignore_path = os.path.join(directory, GITIGNORE_FILENAME)
        try:
            with open(gitignore_path, "r", encoding="utf-8") as f:
                return pathspec.PathSpec.from_lines("gitwildmatch", f)
        except (OSError, UnicodeDecodeError):
            return None

    def _matches_gitignore(
        self,
        specs: list[tuple[str, pathspec.PathSpec]],
        entry_path: str,
        is_dir: bool,
    ) -> bool:
        """Return True if entry_path is ignored by the active .gitignore stack.

        Specs are ordered outermost to innermost. Each spec's patterns are
        interpreted relative to its base_dir, matching git's per-directory
        .gitignore semantics: a deeper .gitignore can re-include a path that
        a shallower one excluded (e.g. ``!important.log``).
        """
        ignored = False
        for base_dir, spec in specs:
            # pathspec's gitwildmatch expects POSIX-style separators
            rel = os.path.relpath(entry_path, base_dir).replace(os.sep, "/")
            check_path = rel + "/" if is_dir else rel
            # include is True (positive match), False (negation/re-include),
            # or None (no pattern matched — leave state as-is).
            result = spec.check_file(check_path)
            if result.include is not None:
                ignored = result.include
        return ignored

    async def scan_disk(
        self,
        path: str,
        excludes: set[str],
        on_disk: dict[str, list[str]] | None = None,
        max_depth: int | None = None,
        current_depth: int = 0,
        respect_gitignore: bool = False,
        gitignore_specs: list[tuple[str, pathspec.PathSpec]] | None = None,
    ) -> dict[str, list[str]]:
        if on_disk is None:
            on_disk = {}
        if gitignore_specs is None:
            gitignore_specs = []

        if max_depth is not None and current_depth >= max_depth:
            return on_disk

        if respect_gitignore:
            spec = self._load_gitignore(path)
            if spec is not None:
                gitignore_specs = gitignore_specs + [(path, spec)]

        for entry in os.scandir(path):
            is_dir = entry.is_dir()
            if respect_gitignore and (
                # The .git directory is not in .gitignore but should never be
                # indexed when honoring git semantics.
                (is_dir and entry.name == ".git")
                or self._matches_gitignore(gitignore_specs, entry.path, is_dir)
            ):
                continue
            if await self.should_hide(entry, excludes):
                continue
            elif is_dir:
                await self.scan_disk(
                    entry.path,
                    excludes,
                    on_disk,
                    max_depth,
                    current_depth + 1,
                    respect_gitignore=respect_gitignore,
                    gitignore_specs=gitignore_specs,
                )
            elif entry.is_file():
                parent = os.path.relpath(os.path.dirname(entry.path), self.root_dir)
                on_disk.setdefault(parent, []).append(entry.name)
        return on_disk

    @web.authenticated
    async def get(self) -> None:
        """Gets the name of every file under the root notebooks directory binned by parent
        folder relative to the root notebooks dir.

        Arguments
        ---------
        exclude: str
            Comma-separated set of file name patterns to exclude
        respect_gitignore: str
            "1"/"true" to skip entries matching .gitignore patterns

        Responds
        --------
        JSON
            scan_seconds: Time in seconds to collect all file names
            contents: File names binned by parent directory
        """
        excludes = set(self.get_arguments("excludes"))
        current_path = self.get_argument("path")
        depth_arg = self.get_argument("depth", default=None)
        max_depth = int(depth_arg) if depth_arg is not None else None
        respect_gitignore = self.get_argument(
            "respect_gitignore", default=""
        ).lower() in ("1", "true")
        start_ts = time.time()
        full_path = os.path.join(self.root_dir, current_path) if current_path else self.root_dir
        contents_by_path = await self.scan_disk(
            full_path,
            excludes,
            max_depth=max_depth,
            respect_gitignore=respect_gitignore,
        )
        delta_ts = time.time() - start_ts
        self.write(json_encode({"scan_seconds": delta_ts, "contents": contents_by_path}))
