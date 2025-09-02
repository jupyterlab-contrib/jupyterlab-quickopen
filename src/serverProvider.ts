import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';
import {
  IQuickOpenProvider,
  IQuickOpenResponse,
  IQuickOpenOptions
} from './tokens';

/**
 * Default implementation of the quick open provider that the server endpoint.
 */
export class ServerQuickOpenProvider implements IQuickOpenProvider {
  /**
   * Fetch contents from the server endpoint.
   */
  async fetchContents(options: IQuickOpenOptions): Promise<IQuickOpenResponse> {
    const { path, excludes, depth } = options;
    const queryParams = excludes.map(
      exclude => 'excludes=' + encodeURIComponent(exclude)
    );

    if (depth !== undefined && depth !== Infinity) {
      queryParams.push('depth=' + depth);
    }

    const query = queryParams.join('&');

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
}
