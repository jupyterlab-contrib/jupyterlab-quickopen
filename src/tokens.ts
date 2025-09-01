import { Token } from '@lumino/coreutils';

/** Structure of the JSON response from the server */
export interface IQuickOpenResponse {
  readonly contents: { [key: string]: string[] };
  readonly scanSeconds: number;
}

/** Options for fetching quick open contents */
export interface IQuickOpenOptions {
  /** The path to search in */
  path: string;
  /** Array of patterns to exclude from results */
  excludes: string[];
  /** Maximum directory depth to search (Infinity for unlimited) */
  depth?: number;
}

/** Interface for quick open content providers */
export interface IQuickOpenProvider {
  /**
   * Fetch contents from the provider
   * @param options Options for the fetch operation
   * @returns Promise with the response containing file contents
   */
  fetchContents(options: IQuickOpenOptions): Promise<IQuickOpenResponse>;
}

/** Token for the quick open provider */
export const IQuickOpenProvider = new Token<IQuickOpenProvider>(
  'jupyterlab-quickopen:IQuickOpenProvider',
  'A provider for quick open file contents'
);
