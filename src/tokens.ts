import { Token } from '@lumino/coreutils';

/** Structure of the JSON response from the server */
export interface IQuickOpenResponse {
  readonly contents: { [key: string]: string[] };
  readonly scanSeconds: number;
}

/** Interface for quick open content providers */
export interface IQuickOpenProvider {
  /**
   * Fetch contents from the provider
   * @param path The path to search in
   * @param excludes Array of patterns to exclude
   * @returns Promise with the response containing file contents
   */
  fetchContents(path: string, excludes: string[]): Promise<IQuickOpenResponse>;
}

/** Token for the quick open provider */
export const IQuickOpenProvider = new Token<IQuickOpenProvider>(
  'jupyterlab-quickopen:IQuickOpenProvider',
  'A provider for quick open file contents'
);
