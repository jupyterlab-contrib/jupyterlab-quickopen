import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette, ModalCommandPalette } from '@jupyterlab/apputils';
import { PathExt } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { FileBrowser, IDefaultFileBrowser } from '@jupyterlab/filebrowser';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { CommandRegistry } from '@lumino/commands';
import { ReadonlyPartialJSONObject } from '@lumino/coreutils';
import { IDisposable } from '@lumino/disposable';
import { Message } from '@lumino/messaging';
import { ISignal, Signal } from '@lumino/signaling';
import { CommandPalette } from '@lumino/widgets';
import { IQuickOpenProvider } from './tokens';
import { DefaultQuickOpenProvider } from './defaultProvider';

/**
 * Shows files nested under directories in the root notebooks directory configured on the server.
 */
class QuickOpenWidget extends CommandPalette {
  private _pathSelected = new Signal<this, string>(this);
  private _settings: ReadonlyPartialJSONObject;
  private _fileBrowser: FileBrowser;
  private _provider: IQuickOpenProvider;
  private _disposables: IDisposable[] = [];

  constructor(
    defaultBrowser: IDefaultFileBrowser,
    settings: ReadonlyPartialJSONObject,
    provider: IQuickOpenProvider,
    options: CommandPalette.IOptions
  ) {
    super(options);

    this.id = 'jupyterlab-quickopen';
    this.title.iconClass = 'jp-SideBar-tabIcon jp-SearchIcon';
    this.title.caption = 'Quick Open';

    this._settings = settings;
    this._fileBrowser = defaultBrowser;
    this._provider = provider;
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
   * Dispose of tracked disposables and clean up commands.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    // Clean up all tracked disposables
    this._disposables.forEach(disposable => disposable.dispose());
    this._disposables.length = 0;

    super.dispose();
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
    const response = await this._provider.fetchContents(
      path,
      this._settings.excludes as string[]
    );

    // Clean up previous commands and remove all paths from the view
    this._disposables.forEach(disposable => disposable.dispose());
    this._disposables.length = 0;
    this.clearItems();

    for (const category in response.contents) {
      for (const fn of response.contents[category]) {
        // Creates commands that are relative file paths on the server
        const command = `${category}/${fn}`;
        if (!this.commands.hasCommand(command)) {
          const disposable = this.commands.addCommand(command, {
            label: fn,
            execute: () => {
              // Emit a selection signal
              this._pathSelected.emit(command);
            }
          });
          this._disposables.push(disposable);
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
  id: 'jupyterlab-quickopen:plugin',
  description: 'Provides a quick open file dialog',
  autoStart: true,
  requires: [
    IDocumentManager,
    ISettingRegistry,
    IDefaultFileBrowser,
    IQuickOpenProvider
  ],
  optional: [ICommandPalette, ITranslator],
  activate: async (
    app: JupyterFrontEnd,
    docManager: IDocumentManager,
    settingRegistry: ISettingRegistry,
    defaultFileBrowser: IDefaultFileBrowser,
    provider: IQuickOpenProvider,
    palette: ICommandPalette | null,
    translator: ITranslator | null
  ) => {
    const trans = (translator ?? nullTranslator).load('jupyterlab-quickopen');
    const commands: CommandRegistry = new CommandRegistry();
    const settings: ISettingRegistry.ISettings = await settingRegistry.load(
      extension.id
    );
    const widget: QuickOpenWidget = new QuickOpenWidget(
      defaultFileBrowser,
      settings.composite,
      provider,
      {
        commands
      }
    );

    // Listen for path selection signals and show the selected files in the appropriate
    // editor/viewer
    widget.pathSelected.connect((_sender: QuickOpenWidget, path: string) => {
      docManager.openOrReveal(PathExt.normalize(path));
    });

    // Listen for setting changes and apply them to the widget
    settings.changed.connect((settings: ISettingRegistry.ISettings) => {
      widget.settings = settings.composite;
    });

    // Add the quick open widget as a modal palette
    const modalPalette = new ModalCommandPalette({ commandPalette: widget });
    modalPalette.attach();

    // Add a command to activate the quickopen sidebar so that the user can find it in the command
    // palette, assign a hotkey, etc.
    const command = 'quickopen:activate';
    app.commands.addCommand(command, {
      label: trans.__('Quick Open'),
      execute: () => {
        modalPalette.activate();
      },
      describedBy: {
        args: {
          type: 'object',
          properties: {}
        }
      }
    });
    if (palette) {
      palette.addItem({ command, category: 'File Operations' });
    }
  }
};

/**
 * Plugin that provides the default quick open provider
 */
const providerPlugin: JupyterFrontEndPlugin<IQuickOpenProvider> = {
  id: 'jupyterlab-quickopen:provider',
  description: 'Provides the default quick open provider',
  autoStart: true,
  provides: IQuickOpenProvider,
  activate: (_app: JupyterFrontEnd): IQuickOpenProvider => {
    return new DefaultQuickOpenProvider();
  }
};

// export plugins as defaults
export default [extension, providerPlugin];

// also export tokens
export * from './tokens';
