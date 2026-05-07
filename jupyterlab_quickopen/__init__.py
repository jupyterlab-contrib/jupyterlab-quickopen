"""Registers the jupyterlab front and backend quickopen extensions"""
from pathlib import Path

from jupyter_server.utils import url_path_join

from .handler import QuickOpenHandler, pathspec

try:
    from ._version import __version__
except ImportError:
    # Fallback when using the package in dev mode without installing
    # in editable mode with pip. It is highly recommended to install
    # the package from a stable release or in editable mode: https://pip.pypa.io/en/stable/topics/local-project-installs/#editable-installs
    import warnings

    warnings.warn("Importing 'jupyterlab_quickopen' outside a proper installation.")
    __version__ = "dev"


def _jupyter_labextension_paths() -> list[dict[str, str]]:
    return [{"src": "labextension", "dest": "jupyterlab-quickopen"}]


def _jupyter_server_extension_points() -> list[dict[str, str]]:
    return [{"module": "jupyterlab_quickopen"}]


def _load_jupyter_server_extension(server_app) -> None:
    """Registers the API handler to receive HTTP requests from the frontend extension.

    Parameters
    ----------
    server_app: jupyterlab.labapp.LabApp
        JupyterLab application instance
    """
    server_app.log.debug("notebook_dir: %s", server_app.notebook_dir)
    server_app.log.debug(
        "contents_manager.root_dir: %s", server_app.contents_manager.root_dir
    )
    if (
        not Path(server_app.root_dir).is_dir()
        or server_app.contents_manager.root_dir != server_app.root_dir
    ):
        server_app.log.info(
            f"Refusing to register QuickOpenHandler extension: "
            f"{server_app.contents_manager} does not appear to load from the local filesystem"
        )
        return

    web_app = server_app.web_app
    host_pattern = ".*$"
    route_pattern = url_path_join(
        web_app.settings["base_url"], "jupyterlab-quickopen", "api", "files"
    )
    web_app.add_handlers(host_pattern, [(route_pattern, QuickOpenHandler)])
    server_app.log.info(
        f"Registered QuickOpenHandler extension at URL path {route_pattern} "
        f"to serve results of scanning local path {server_app.notebook_dir}"
    )
    if pathspec is None:
        server_app.log.warning(
            "The 'pathspec' package is not installed; the 'respectGitignore' "
            "setting will have no effect. Install with 'pip install pathspec' "
            "to enable .gitignore filtering."
        )
