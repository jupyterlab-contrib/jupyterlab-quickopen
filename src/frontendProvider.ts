import { PathExt } from '@jupyterlab/coreutils';
import { Contents } from '@jupyterlab/services';
import {
  IQuickOpenOptions,
  IQuickOpenProvider,
  IQuickOpenResponse
} from './tokens';

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
    const { path, excludes, depth } = options;
    const startTime = performance.now();
    const contents: { [key: string]: string[] } = {};

    try {
      const maxDepth = depth ?? Infinity;
      await this._walkDirectory(path, excludes, contents, maxDepth);
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
   */
  private async _walkDirectory(
    dirPath: string,
    excludes: string[],
    contents: { [key: string]: string[] },
    maxDepth: number = Infinity,
    currentDepth: number = 0
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

      for (const item of listing.content) {
        const itemPath = dirPath ? PathExt.join(dirPath, item.name) : item.name;

        // Check if item should be excluded
        if (this._shouldExclude(item.name, itemPath, excludes)) {
          continue;
        }

        if (item.type === 'directory') {
          // Recursively walk subdirectories
          await this._walkDirectory(
            itemPath,
            excludes,
            contents,
            maxDepth,
            currentDepth + 1
          );
        } else {
          // Add file to contents under its directory category
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
      // Simple pattern matching - can be enhanced with glob patterns
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
