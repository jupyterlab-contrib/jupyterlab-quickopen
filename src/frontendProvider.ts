import { PathExt } from '@jupyterlab/coreutils';
import { Contents } from '@jupyterlab/services';
import ignore, { Ignore } from 'ignore';
import {
  IQuickOpenOptions,
  IQuickOpenProvider,
  IQuickOpenResponse
} from './tokens';

const GITIGNORE_FILENAME = '.gitignore';

/**
 * A parsed .gitignore associated with the directory it lives in.
 */
interface IGitignoreSpec {
  baseDir: string;
  ig: Ignore;
}

/**
 * Frontend implementation of the quick open provider that uses the Contents API.
 */
export class FrontendQuickOpenProvider implements IQuickOpenProvider {
  /**
   * Create a new frontend quick open provider.
   * @param options Options for creating the provider
   */
  constructor(options: FrontendQuickOpenProvider.IOptions) {
    this._contentsManager = options.contentsManager;
  }

  /**
   * Fetch contents from the filesystem using the Contents API.
   * @param options Options for the fetch operation
   * @returns Promise resolving to contents and scan time
   */
  async fetchContents(options: IQuickOpenOptions): Promise<IQuickOpenResponse> {
    const { path, excludes, depth, respectGitignore } = options;
    const startTime = performance.now();
    const contents: { [key: string]: string[] } = {};

    try {
      const maxDepth = depth ?? Infinity;
      await this._walkDirectory(
        path,
        excludes,
        contents,
        maxDepth,
        0,
        [],
        respectGitignore ?? false
      );
    } catch (error) {
      console.warn('Error walking directory:', error);
    }

    const scanSeconds = (performance.now() - startTime) / 1000;
    return { contents, scanSeconds };
  }

  /**
   * Recursively walk a directory and collect file listings.
   * @param dirPath The directory path to walk
   * @param excludes Array of patterns to exclude
   * @param contents Object to accumulate results in
   * @param maxDepth Maximum recursion depth
   * @param currentDepth Current recursion depth
   * @param gitignoreSpecs Active .gitignore specs inherited from ancestor directories
   * @param respectGitignore Whether to honor .gitignore files
   */
  private async _walkDirectory(
    dirPath: string,
    excludes: string[],
    contents: { [key: string]: string[] },
    maxDepth: number = Infinity,
    currentDepth: number = 0,
    gitignoreSpecs: IGitignoreSpec[] = [],
    respectGitignore: boolean = false
  ): Promise<void> {
    if (currentDepth >= maxDepth) {
      return;
    }

    try {
      const listing = await this._contentsManager.get(dirPath, {
        content: true,
        type: 'directory'
      });

      if (!listing.content) {
        return;
      }

      let activeSpecs = gitignoreSpecs;
      if (respectGitignore) {
        const spec = await this._loadGitignore(dirPath, listing.content);
        if (spec) {
          activeSpecs = [...gitignoreSpecs, spec];
        }
      }

      for (const item of listing.content) {
        const itemPath = dirPath ? PathExt.join(dirPath, item.name) : item.name;
        const isDir = item.type === 'directory';

        if (
          respectGitignore &&
          ((isDir && item.name === '.git') ||
            this._matchesGitignore(activeSpecs, itemPath, isDir))
        ) {
          continue;
        }

        if (this._shouldExclude(item.name, itemPath, excludes)) {
          continue;
        }

        if (isDir) {
          await this._walkDirectory(
            itemPath,
            excludes,
            contents,
            maxDepth,
            currentDepth + 1,
            activeSpecs,
            respectGitignore
          );
        } else {
          const category = dirPath || '.';
          if (!contents[category]) {
            contents[category] = [];
          }
          contents[category].push(item.name);
        }
      }
    } catch (error) {
      // Silently skip directories we can't access
      console.debug(`Skipping directory ${dirPath}:`, error);
    }
  }

  /**
   * Read the .gitignore file in the given directory if listed, and parse it.
   *
   * Requires the Contents API to expose hidden files since .gitignore is
   * dot-prefixed; if it isn't visible in the directory listing, no spec is
   * returned.
   */
  private async _loadGitignore(
    dirPath: string,
    items: Contents.IModel[]
  ): Promise<IGitignoreSpec | null> {
    const entry = items.find(
      item => item.name === GITIGNORE_FILENAME && item.type === 'file'
    );
    if (!entry) {
      return null;
    }
    const itemPath = dirPath
      ? PathExt.join(dirPath, GITIGNORE_FILENAME)
      : GITIGNORE_FILENAME;
    try {
      const file = await this._contentsManager.get(itemPath, {
        content: true,
        format: 'text',
        type: 'file'
      });
      const text =
        typeof file.content === 'string' ? file.content : String(file.content);
      const ig = ignore().add(text);
      return { baseDir: dirPath || '.', ig };
    } catch (error) {
      console.debug(`Could not read ${itemPath}:`, error);
      return null;
    }
  }

  /**
   * Check whether an item path is ignored by the active .gitignore stack.
   *
   * Specs are ordered outermost to innermost. Each spec is interpreted
   * relative to the directory it came from, matching git's per-directory
   * .gitignore semantics: a deeper .gitignore can re-include a path that
   * a shallower one excluded (e.g. `!important.log`).
   */
  private _matchesGitignore(
    specs: IGitignoreSpec[],
    itemPath: string,
    isDir: boolean
  ): boolean {
    let ignored = false;
    for (const { baseDir, ig } of specs) {
      const rel =
        baseDir === '.' ? itemPath : PathExt.relative(baseDir, itemPath);
      if (!rel || rel.startsWith('..')) {
        continue;
      }
      const candidate = isDir ? rel + '/' : rel;
      const result = ig.test(candidate);
      // ignored:   matched a positive pattern in this spec
      // unignored: matched a negation pattern in this spec
      if (result.ignored) {
        ignored = true;
      } else if (result.unignored) {
        ignored = false;
      }
    }
    return ignored;
  }

  /**
   * Check if a file should be excluded from results.
   * @param filename The filename to check
   * @param fullPath The full path to check
   * @param excludes Array of exclusion patterns
   * @returns True if the file should be excluded
   */
  private _shouldExclude(
    filename: string,
    fullPath: string,
    excludes: string[]
  ): boolean {
    for (const exclude of excludes) {
      // TODO: support globs instead of simple string matching
      if (
        filename.includes(exclude) ||
        fullPath.includes(exclude) ||
        (filename.startsWith('.') && exclude === '.*')
      ) {
        return true;
      }
    }
    return false;
  }

  private _contentsManager: Contents.IManager;
}

/**
 * A namespace for the frontend quick open provider statics.
 */
export namespace FrontendQuickOpenProvider {
  /**
   * Options for creating a frontend quick open provider.
   */
  export interface IOptions {
    /**
     * The contents manager to use for file operations
     */
    contentsManager: Contents.IManager;
  }
}
