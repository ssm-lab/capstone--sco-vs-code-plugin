import { existsSync } from 'fs';
import { join } from 'path';
import * as vscode from 'vscode';
import childProcess from 'child_process';

export class DependencyManager {
  static async ensureDependencies(
    context: vscode.ExtensionContext,
  ): Promise<boolean> {
    const venvPath = join(context.extensionPath, '.venv');
    if (existsSync(venvPath)) return true;

    const choice = await vscode.window.showErrorMessage(
      'Python dependencies missing. Install now?',
      'Install',
      'Cancel',
    );

    if (choice === 'Install') {
      return vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Installing dependencies...',
        },
        async () => {
          try {
            await this.runInstaller(context);
            return true;
          } catch (error) {
            vscode.window.showErrorMessage(`Installation failed: ${error}`);
            return false;
          }
        },
      );
    }
    return false;
  }

  private static async runInstaller(
    context: vscode.ExtensionContext,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const installer = childProcess.spawn('node', ['dist/install.js'], {
        cwd: context.extensionPath,
        stdio: 'inherit',
      });
      installer.on('close', (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`Installer exited with code ${code}`)),
      );
    });
  }
}
