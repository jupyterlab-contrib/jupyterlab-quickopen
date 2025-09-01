import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';
import { IQuickOpenProvider, IQuickOpenResponse } from './tokens';

/**
 * Default implementation of the quick open provider that the server endpoint.
 */
export class DefaultQuickOpenProvider implements IQuickOpenProvider {
  async fetchContents(
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
}
