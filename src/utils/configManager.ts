import * as vscode from 'vscode';

export class ConfigManager {
  // resolve ${workspaceFolder} placeholder
  private static resolvePath(path: string): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    return path.replace('${workspaceFolder}', workspaceFolder);
  }

  // get workspace path
  static getWorkspacePath(): string {
    const rawPath = vscode.workspace
      .getConfiguration('ecooptimizer-vs-code-plugin')
      .get<string>('projectWorkspacePath', '');
    const resolvedPath =
      rawPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

    // write to both User and Workspace settings if not already set
    this.writeSetting('projectWorkspacePath', resolvedPath);

    return resolvedPath;
  }

  // get logs output path
  static getLogsOutputPath(): string {
    const rawPath = vscode.workspace
      .getConfiguration('ecooptimizer-vs-code-plugin')
      .get<string>('logsOutputPath', '');
    const workspacePath = this.getWorkspacePath();
    const resolvedPath = rawPath || `${workspacePath}/logs`;

    // write to both User and Workspace settings if not already set
    this.writeSetting('logsOutputPath', resolvedPath);

    return resolvedPath;
  }

  // listen for configuration changes
  static onConfigChange(callback: () => void): void {
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration(
          'ecooptimizer-vs-code-plugin.projectWorkspacePath',
        ) ||
        event.affectsConfiguration('ecooptimizer-vs-code-plugin.logsOutputPath')
      ) {
        callback();
      }
    });
  }

  // write settings to both User and Workspace if necessary
  private static writeSetting(setting: string, value: string): void {
    const config = vscode.workspace.getConfiguration('ecooptimizer-vs-code-plugin');

    // inspect current values in both User and Workspace settings
    const currentValueGlobal = config.inspect<string>(setting)?.globalValue;
    const currentValueWorkspace = config.inspect<string>(setting)?.workspaceValue;

    // update User Settings (Global) if empty
    if (!currentValueGlobal || currentValueGlobal.trim() === '') {
      config.update(setting, value, vscode.ConfigurationTarget.Global);
    }

    // update Workspace Settings if empty
    if (!currentValueWorkspace || currentValueWorkspace.trim() === '') {
      config.update(setting, value, vscode.ConfigurationTarget.Workspace);
    }
  }
}
