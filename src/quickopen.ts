import { URLExt, PathExt } from '@jupyterlab/coreutils';
import { FileBrowser, IDefaultFileBrowser } from '@jupyterlab/filebrowser';
import { Contents, ServerConnection } from '@jupyterlab/services';

import { ReadonlyPartialJSONObject } from '@lumino/coreutils';
import { Message } from '@lumino/messaging';
import { ISignal, Signal } from '@lumino/signaling';
import { CommandPalette } from '@lumino/widgets';

import { minimatch } from 'minimatch';

/** Structure of the JSON response from the server */
interface IQuickOpenResponse {
  readonly contents: { [key: string]: string[] };
  readonly scanSeconds: number;
}

class DefaultDict<K, V> extends Map<K, V> {
  private defaultFactory: () => V;

  constructor(
    defaultFactory: () => V,
    entries?: readonly (readonly [K, V])[] | null
  ) {
    super(entries);
    this.defaultFactory = defaultFactory;
  }

  get(key: K): V {
    if (!this.has(key)) {
      const defaultValue = this.defaultFactory();
      this.set(key, defaultValue);
      return defaultValue;
    }
    return super.get(key)!;
  }
}

/** Makes a HTTP request for the server-side quick open scan */
async function fetchServerContents(
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

async function fetchContents(
  contents: Contents.IManager
): Promise<IQuickOpenResponse> {
  const defaultIgnorePatterns = new Set([
    'node_modules',
    'dist',
    '.git',
    '.cache',
    'build',
    'coverage',
    'tmp',
    'temp',
    '*.log'
  ]);

  // // Function to fetch the content of the .gitignore file
  // const fetchGitignore = async (): Promise<Set<string>> => {
  //   try {
  //     const response = await contents.get('.gitignore', { content: true });
  //     if (response.type === 'file') {
  //       const patterns = response.content
  //         .split('\n')
  //         .filter((line: string) => line.trim() !== '')
  //         .map((line: string) => line.replace(/\/$/, ''));

  //       return new Set(patterns);
  //     }
  //   } catch (error) {
  //     console.warn('.gitignore file not found or could not be read.');
  //   }
  //   return new Set();
  // };

  const isIgnored = (path: string, ignorePatterns: Set<string>): boolean => {
    return [...ignorePatterns].some(pattern => {
      return minimatch(path, pattern);
    });
  };

  // Function to fetch all file names, filtering out those matching .gitignore patterns
  const dict = new DefaultDict<string, string[]>(() => []);
  const fetchAllFiles = async (path: string, ignorePatterns: Set<string>) => {
    try {
      const response = await contents.get(path, { content: true });
      if (response.type === 'directory') {
        for (const item of response.content) {
          if (!isIgnored(item.path, ignorePatterns)) {
            if (item.type === 'directory') {
              await fetchAllFiles(item.path, ignorePatterns);
            } else {
              const basename = PathExt.basename(item.path);
              const folders = item.path.split(basename)[0];
              dict.get(folders).push(basename);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  // Fetch .gitignore patterns
  // const gitignorePatterns = await fetchGitignore();
  // console.log('.gitignore patterns:', gitignorePatterns);

  // Merge default ignore patterns with .gitignore patterns
  // const combinedIgnorePatterns = new Set([
  //   ...defaultIgnorePatterns,
  //   ...gitignorePatterns
  // ]);
  const combinedIgnorePatterns = new Set([...defaultIgnorePatterns]);
  await fetchAllFiles('', combinedIgnorePatterns);
  const results: { [key: string]: string[] } = {};
  for (const [key, value] of dict.entries()) {
    results[key] = value;
  }
  return {
    contents: results,
    scanSeconds: 0
  };
}

/**
 * Shows files nested under directories in the root notebooks directory configured on the server.
 */
export class QuickOpenWidget extends CommandPalette {
  constructor(options: QuickOpenWidget.IOptions) {
    super(options.commandPaletteOptions);

    this.id = 'jupyterlab-quickopen';
    this.title.iconClass = 'jp-SideBar-tabIcon jp-SearchIcon';
    this.title.caption = 'Quick Open';

    const { defaultBrowser, settings } = options;
    this._settings = settings;
    this._fileBrowser = defaultBrowser;
    this._contents = options.contents;
    this._useServer = options.useServer ?? true;
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

    let response: IQuickOpenResponse;
    if (this._useServer) {
      response = await fetchServerContents(
        path,
        this._settings.excludes as string[]
      );
    } else {
      response = await fetchContents(this._contents);
    }

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

  private _pathSelected = new Signal<this, string>(this);
  private _settings: ReadonlyPartialJSONObject;
  private _fileBrowser: FileBrowser;
  private _useServer = true;
  private _contents: Contents.IManager;
}

export namespace QuickOpenWidget {
  export interface IOptions {
    defaultBrowser: IDefaultFileBrowser;
    settings: ReadonlyPartialJSONObject;
    commandPaletteOptions: CommandPalette.IOptions;
    contents: Contents.IManager;
    useServer?: boolean;
  }
}
