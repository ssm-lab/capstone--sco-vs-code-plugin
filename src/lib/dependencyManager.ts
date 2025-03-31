import { existsSync } from 'fs';
import { join } from 'path';
import * as vscode from 'vscode';
import childProcess from 'child_process';

/**
 * Handles Python dependency management for the extension.
 * Creates and manages a virtual environment (.venv) in the extension directory
 * and provides installation capabilities when dependencies are missing.
 */
export class DependencyManager {
  /**
   * Ensures required dependencies are installed. Checks for existing virtual environment
   * and prompts user to install if missing.
   *
   * @param context - Extension context containing installation path
   * @returns Promise resolving to true if dependencies are available, false otherwise
   */
  static async ensureDependencies(
    context: vscode.ExtensionContext,
  ): Promise<boolean> {
    // Check for existing virtual environment
    const venvPath = join(context.extensionPath, '.venv');
    if (existsSync(venvPath)) return true;

    // Prompt user to install dependencies if venv doesn't exist
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

  /**
   * Executes the dependency installation process in a child process.
   * Shows progress to user and handles installation errors.
   *
   * @param context - Extension context containing installation path
   * @throws Error when installation process fails
   */
  private static async runInstaller(
    context: vscode.ExtensionContext,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Spawn installer process with inherited stdio for live output
      const installer = childProcess.spawn('node', ['dist/install.js'], {
        cwd: context.extensionPath,
        stdio: 'inherit', // Show installation progress in parent console
      });

      installer.on('close', (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`Installer exited with code ${code}`)),
      );
    });
  }
}
