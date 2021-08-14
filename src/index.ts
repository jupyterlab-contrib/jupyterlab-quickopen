import {
  ILabShell,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette } from '@jupyterlab/apputils';
import { URLExt, PathExt } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { ServerConnection } from '@jupyterlab/services';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { FileBrowser, IFileBrowserFactory } from '@jupyterlab/filebrowser';
import { CommandRegistry } from '@lumino/commands';
import { ReadonlyPartialJSONObject } from '@lumino/coreutils';
import { Message } from '@lumino/messaging';
import { ISignal, Signal } from '@lumino/signaling';
import { CommandPalette } from '@lumino/widgets';

/** Structure of the JSON response from the server */
interface IQuickOpenResponse {
  readonly contents: { [key: string]: string[] };
  readonly scanSeconds: number;
}

/** Makes a HTTP request for the server-side quick open scan */
async function fetchContents(
  path: string,
  excludes: string[]
): Promise<IQuickOpenResponse> {
  const query = excludes
    .map(exclude => {
      return 'excludes=' + encodeURIComponent(exclude);
    })
    .join('&');

  const settings = ServerConnection.makeSettings();
  const fullUrl =
    URLExt.join(settings.baseUrl, 'jupyterlab-quickopen', 'api', 'files') +
    '?' +
    query +
    '&path=' +
    path;
  const response = await ServerConnection.makeRequest(
    fullUrl,
    { method: 'GET' },
    settings
  );
  if (response.status !== 200) {
    throw new ServerConnection.ResponseError(response);
  }
  return await response.json();
}

/**
 * Shows files nested under directories in the root notebooks directory configured on the server.
 */
class QuickOpenWidget extends CommandPalette {
  private _pathSelected = new Signal<this, string>(this);
  private _settings: ReadonlyPartialJSONObject;
  private _fileBrowser: FileBrowser;

  constructor(
    factory: IFileBrowserFactory,
    settings: ReadonlyPartialJSONObject,
    options: CommandPalette.IOptions
  ) {
    super(options);

    this.id = 'jupyterlab-quickopen';
    this.title.iconClass = 'jp-SideBar-tabIcon jp-SearchIcon';
    this.title.caption = 'Quick Open';

    this._settings = settings;
    this._fileBrowser = factory.defaultBrowser;
  }

  /** Signal when a selected path is activated. */
  get pathSelected(): ISignal<this, string> {
    return this._pathSelected;
  }

  /** Current extension settings */
  set settings(settings: ReadonlyPartialJSONObject) {
    this._settings = settings;
  }

  /**
   * Refreshes the widget with the paths of files on the server.
   */
  protected async onActivateRequest(msg: Message): Promise<void> {
    super.onActivateRequest(msg);

    // Fetch the current contents from the server
    const path = this._settings.relativeSearch
      ? this._fileBrowser.model.path
      : '';
    const response = await fetchContents(
      path,
      this._settings.excludes as string[]
    );

    // Remove all paths from the view
    this.clearItems();

    for (const category in response.contents) {
      for (const fn of response.contents[category]) {
        // Creates commands that are relative file paths on the server
        const command = `${category}/${fn}`;
        if (!this.commands.hasCommand(command)) {
          // Only add the command to the registry if it does not yet exist TODO: Track disposables
          // and remove
          this.commands.addCommand(command, {
            label: fn,
            execute: () => {
              // Emit a selection signal
              this._pathSelected.emit(command);
            }
          });
        }
        // Make the file visible under its parent directory heading
        this.addItem({ command, category });
      }
    }
  }
}

/**
 * Initialization data for the jupyterlab-quickopen extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: '@parente/jupyterlab-quickopen:plugin',
  autoStart: true,
  requires: [
    ICommandPalette,
    IDocumentManager,
    ILabShell,
    ISettingRegistry,
    IFileBrowserFactory
  ],
  activate: async (
    app: JupyterFrontEnd,
    palette: ICommandPalette,
    docManager: IDocumentManager,
    labShell: ILabShell,
    settingRegistry: ISettingRegistry,
    fileBrowserFactory: IFileBrowserFactory
  ) => {
    console.log(`Activated extension: ${extension.id}`);
    const commands: CommandRegistry = new CommandRegistry();
    const settings: ISettingRegistry.ISettings = await settingRegistry.load(
      extension.id
    );
    const widget: QuickOpenWidget = new QuickOpenWidget(
      fileBrowserFactory,
      settings.composite,
      {
        commands
      }
    );

    // Listen for path selection signals and show the selected files in the appropriate
    // editor/viewer
    widget.pathSelected.connect((sender: QuickOpenWidget, path: string) => {
      labShell.collapseLeft();
      docManager.openOrReveal(PathExt.normalize(path));
    });

    // Listen for setting changes and apply them to the widget
    settings.changed.connect((settings: ISettingRegistry.ISettings) => {
      widget.settings = settings.composite;
    });

    // Add a command to activate the quickopen sidebar so that the user can find it in the command
    // palette, assign a hotkey, etc.
    const command = 'quickopen:activate';
    app.commands.addCommand(command, {
      label: 'Quick Open',
      execute: () => {
        labShell.activateById(widget.id);
      }
    });
    palette.addItem({ command, category: 'File Operations' });

    // Add the quickopen widget as a left sidebar
    labShell.add(widget, 'left', { rank: 1000 });
  }
};

export default extension;
