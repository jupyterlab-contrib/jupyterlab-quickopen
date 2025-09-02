import { IDefaultFileBrowser } from '@jupyterlab/filebrowser';
import { ReadonlyPartialJSONObject } from '@lumino/coreutils';
import { IDisposable } from '@lumino/disposable';
import { Message } from '@lumino/messaging';
import { ISignal, Signal } from '@lumino/signaling';
import { CommandPalette } from '@lumino/widgets';
import { IQuickOpenProvider } from './tokens';

/**
 * Shows files nested under directories in the root notebooks directory configured on the server.
 */
export class QuickOpenWidget extends CommandPalette {
  /**
   * Create a new QuickOpenWidget.
   */
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
    const depth = this._settings.depth as number;
    const response = await this._provider.fetchContents({
      path,
      excludes: this._settings.excludes as string[],
      depth: depth
    });

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

  private _pathSelected = new Signal<this, string>(this);
  private _settings: ReadonlyPartialJSONObject;
  private _fileBrowser: IDefaultFileBrowser;
  private _provider: IQuickOpenProvider;
  private _disposables: IDisposable[] = [];
}
