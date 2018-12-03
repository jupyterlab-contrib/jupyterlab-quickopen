import os

from .handler import QuickOpenHandler
from ._version import get_versions
from notebook.utils import url_path_join


__version__ = get_versions()['version']
del get_versions


def _jupyter_server_extension_paths():
    """Defines the entrypoint for the Jupyter server extension."""
    return [{
        "module": "jupyterlab_quickopen"
    }]


def load_jupyter_server_extension(nb_app):
    """Registers the quick open API handler to receive HTTP requests from the frontend extension.

    Parameters
    ----------
    nb_app: notebook.notebookapp.NotebookApp
        Notebook application instance
    """
    if (not os.path.isdir(nb_app.notebook_dir)
        or nb_app.contents_manager.root_dir != nb_app.notebook_dir):
        nb_app.log.info(f'Refusing to register QuickOpenHandler extension: '
            f'{nb_app.contents_manager} does not appear to load from the local filesystem')
        return

    web_app = nb_app.web_app
    host_pattern = '.*$'
    route_pattern = url_path_join(web_app.settings['base_url'], '/api/quickopen')
    web_app.add_handlers(host_pattern, [
        (route_pattern, QuickOpenHandler)
    ])
    nb_app.log.info(f'Registered QuickOpenHandler extension at URL path {route_pattern} '
                    f'to serve results of scanning local path {nb_app.notebook_dir}')
