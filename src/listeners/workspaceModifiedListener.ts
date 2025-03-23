import * as vscode from 'vscode';
import { SmellsCacheManager } from '../context/SmellsCacheManager';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { MetricsViewProvider } from '../providers/MetricsViewProvider';
import { ecoOutput } from '../extension';

/**
 * Listens for workspace modifications (file creation, deletion, and saves)
 * and refreshes the SmellsViewProvider and MetricsViewProvider accordingly.
 */
export class WorkspaceModifiedListener {
  private fileWatcher: vscode.FileSystemWatcher | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    private smellsCacheManager: SmellsCacheManager,
    private smellsViewProvider: SmellsViewProvider,
    private metricsViewProvider: MetricsViewProvider,
  ) {
    this.initializeFileWatcher();
  }

  /**
   * Initializes the file system watcher for the configured workspace.
   */
  private initializeFileWatcher(): void {
    const configuredPath = this.context.workspaceState.get<string>(
      'workspaceConfiguredPath',
    );
    if (!configuredPath) {
      return; // No workspace configured
    }

    ecoOutput.appendLine(`Watching workspace: ${configuredPath}`);

    this.fileWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(configuredPath, '**/*.py'),
      false, // do not ignore create events
      false, // do not ignore change events
      false, // do not ignore delete events
    );

    this.fileWatcher.onDidCreate(() => {
      ecoOutput.appendLine('A Python file was created.');
      this.refreshViews();
    });

    this.fileWatcher.onDidChange((uri) => {
      ecoOutput.appendLine(`A Python file was modified and saved: ${uri.fsPath}`);
      this.handleFileChange(uri.fsPath);
    });

    this.fileWatcher.onDidDelete((uri) => {
      ecoOutput.appendLine(`A Python file was deleted: ${uri.fsPath}`);
      this.handleFileDeletion(uri.fsPath);
    });
  }

  /**
   * Handles file changes by clearing the cache for the modified file and marking it as outdated.
   * @param filePath - The path of the modified file.
   */
  private async handleFileChange(filePath: string): Promise<void> {
    if (this.smellsCacheManager.hasCachedSmells(filePath)) {
      await this.smellsCacheManager.clearCachedSmellsForFile(filePath);
      this.smellsViewProvider.setStatus(filePath, 'outdated');

      vscode.window.showInformationMessage(
        `File modified: ${filePath}\nSmell results are now outdated. Please reanalyze.`,
      );
    }
    this.refreshViews();
  }

  /**
   * Handles file deletions by clearing the cache and removing from the tree view.
   */
  private async handleFileDeletion(filePath: string): Promise<void> {
    let removed = false;

    if (this.smellsCacheManager.hasCachedSmells(filePath)) {
      await this.smellsCacheManager.clearCachedSmellsForFile(filePath);
      removed = true;
    }

    const removedFromTree = this.smellsViewProvider.removeFile(filePath);
    removed ||= removedFromTree;

    if (removed) {
      vscode.window.showInformationMessage(
        `Removed deleted file from smells view: ${filePath}`,
      );
    }

    this.refreshViews();
  }

  /**
   * Refreshes both views.
   */
  private refreshViews(): void {
    this.smellsViewProvider.refresh();
    this.metricsViewProvider.refresh();
  }

  /**
   * Disposes any resources.
   */
  public dispose(): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
    }
  }
}
