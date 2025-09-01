import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette, ModalCommandPalette } from '@jupyterlab/apputils';
import { PathExt } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { IDefaultFileBrowser } from '@jupyterlab/filebrowser';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { CommandRegistry } from '@lumino/commands';
import { FrontendQuickOpenProvider } from './frontendProvider';
import { ServerQuickOpenProvider } from './serverProvider';
import { IQuickOpenProvider } from './tokens';
import { QuickOpenWidget } from './widget';

/**
 * The main quickopen plugin.
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

    widget.pathSelected.connect((_sender: QuickOpenWidget, path: string) => {
      docManager.openOrReveal(PathExt.normalize(path));
    });

    settings.changed.connect((settings: ISettingRegistry.ISettings) => {
      widget.settings = settings.composite;
    });

    const modalPalette = new ModalCommandPalette({ commandPalette: widget });
    modalPalette.attach();

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
 * Plugin that provides the quick open provider
 */
const providerPlugin: JupyterFrontEndPlugin<IQuickOpenProvider> = {
  id: 'jupyterlab-quickopen:provider',
  description: 'Provides the quick open provider',
  autoStart: true,
  provides: IQuickOpenProvider,
  requires: [ISettingRegistry],
  activate: (
    app: JupyterFrontEnd,
    settingRegistry: ISettingRegistry
  ): IQuickOpenProvider => {
    let currentProvider: IQuickOpenProvider = new ServerQuickOpenProvider();

    const updateProvider = async () => {
      const settings = await settingRegistry.load(
        'jupyterlab-quickopen:plugin'
      );
      const indexingMethod = settings.get('indexingMethod').composite as string;

      if (indexingMethod === 'frontend') {
        currentProvider = new FrontendQuickOpenProvider({
          contentsManager: app.serviceManager.contents
        });
      } else {
        currentProvider = new ServerQuickOpenProvider();
      }
    };

    updateProvider();

    settingRegistry.load('jupyterlab-quickopen:plugin').then(settings => {
      settings.changed.connect(updateProvider);
    });

    // Return a wrapper that delegates to the current provider
    return {
      fetchContents: options => {
        return currentProvider.fetchContents(options);
      }
    };
  }
};

// export plugins as defaults
export default [extension, providerPlugin];

// also export tokens
export * from './tokens';
