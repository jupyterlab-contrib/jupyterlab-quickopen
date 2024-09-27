import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette, ModalCommandPalette } from '@jupyterlab/apputils';
import { PathExt } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { IDefaultFileBrowser } from '@jupyterlab/filebrowser';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { CommandRegistry } from '@lumino/commands';
import { QuickOpenWidget } from './quickopen';

/**
 * Initialization data for the jupyterlab-quickopen extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-quickopen:plugin',
  autoStart: true,
  requires: [IDocumentManager, ISettingRegistry, IDefaultFileBrowser],
  optional: [ICommandPalette, ITranslator],
  activate: async (
    app: JupyterFrontEnd,
    docManager: IDocumentManager,
    settingRegistry: ISettingRegistry,
    defaultFileBrowser: IDefaultFileBrowser,
    palette: ICommandPalette | null,
    translator: ITranslator | null
  ) => {
    const trans = (translator ?? nullTranslator).load('jupyterlab-quickopen');
    const commands: CommandRegistry = new CommandRegistry();
    const settings: ISettingRegistry.ISettings = await settingRegistry.load(
      extension.id
    );
    const widget: QuickOpenWidget = new QuickOpenWidget({
      defaultBrowser: defaultFileBrowser,
      settings: settings.composite,
      commandPaletteOptions: { commands },
      contents: app.serviceManager.contents,
      // TODO: remove
      useServer: false
    });

    // Listen for path selection signals and show the selected files in the appropriate
    // editor/viewer
    widget.pathSelected.connect((sender: QuickOpenWidget, path: string) => {
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
      }
    });
    if (palette) {
      palette.addItem({ command, category: 'File Operations' });
    }
  }
};

export default extension;
