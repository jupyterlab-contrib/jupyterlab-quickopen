"""Registers the jupyterlab front and backend quickopen extensions"""
import json
import os.path as osp

from ._version import __version__

HERE = osp.abspath(osp.dirname(__file__))

with open(osp.join(HERE, "labextension", "package.json")) as fid:
    data = json.load(fid)


def _jupyter_labextension_paths():
    return [{"src": "labextension", "dest": data["name"]}]


from .handler import QuickOpenHandler
from jupyter_server.utils import url_path_join


def _jupyter_server_extension_points():
    return [{"module": "jupyterlab_quickopen"}]


def _load_jupyter_server_extension(server_app):
    """Registers the API handler to receive HTTP requests from the frontend extension.

    Parameters
    ----------
    lab_app: jupyterlab.labapp.LabApp
        JupyterLab application instance
    """
    server_app.log.debug("notebook_dir: %s", server_app.notebook_dir)
    server_app.log.debug(
        "contents_manager.root_dir: %s", server_app.contents_manager.root_dir
    )
    if (
        not osp.isdir(server_app.root_dir)
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
