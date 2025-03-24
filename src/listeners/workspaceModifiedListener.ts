import * as vscode from 'vscode';
import { SmellsCacheManager } from '../context/SmellsCacheManager';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { MetricsViewProvider } from '../providers/MetricsViewProvider';

/**
 * Listens for workspace modifications (file creation, deletion, and changes)
 * and refreshes the SmellsViewProvider and MetricsViewProvider accordingly.
 */
export class WorkspaceModifiedListener {
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  private saveListener: vscode.Disposable | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    private smellsCacheManager: SmellsCacheManager,
    private smellsViewProvider: SmellsViewProvider,
    private metricsViewProvider: MetricsViewProvider,
  ) {
    this.initializeFileWatcher();
    this.initializeSaveListener();
  }

  /**
   * Initializes the file system watcher for the configured workspace.
   */
  private initializeFileWatcher(): void {
    const configuredPath = this.context.workspaceState.get<string>(
      'workspaceConfiguredPath',
    );
    if (!configuredPath) return;

    this.fileWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(configuredPath, '**/*.py'),
      false, // Do not ignore create events
      false, // Do not ignore change events
      false, // Do not ignore delete events
    );

    this.fileWatcher.onDidCreate(() => this.refreshViews());
    this.fileWatcher.onDidChange((uri) => this.handleFileChange(uri.fsPath));
    this.fileWatcher.onDidDelete((uri) => this.handleFileDeletion(uri.fsPath));
  }

  /**
   * Initializes a listener for file save events to handle changes in Python files.
   */
  private initializeSaveListener(): void {
    this.saveListener = vscode.workspace.onDidSaveTextDocument((document) => {
      if (document.languageId === 'python') {
        this.handleFileChange(document.uri.fsPath);
      }
    });
  }

  /**
   * Handles file changes by clearing the cache for the modified file and marking it as outdated,
   * but only if the file had previously been analyzed (i.e., is in the cache).
   * @param filePath - The path of the modified file.
   */
  private async handleFileChange(filePath: string): Promise<void> {
    const hadCache = this.smellsCacheManager.getAllFilePaths().includes(filePath);
    if (!hadCache) return; // Skip if no analysis was done before

    await this.smellsCacheManager.clearCachedSmellsForFile(filePath);
    this.smellsViewProvider.setStatus(filePath, 'outdated');

    vscode.window.showInformationMessage(
      `File modified: ${filePath}\nAnalysis data is now outdated.`,
    );

    this.refreshViews();
  }

  /**
   * Handles file deletions by clearing the cache and removing the file from the tree view.
   * @param filePath - The path of the deleted file.
   */
  private async handleFileDeletion(filePath: string): Promise<void> {
    const hadCache = this.smellsCacheManager.getAllFilePaths().includes(filePath);
    let removed = false;

    if (hadCache) {
      await this.smellsCacheManager.clearCachedSmellsByPath(filePath);
      removed = true;
    }

    const removedFromTree = this.smellsViewProvider.removeFile(filePath);
    removed ||= removedFromTree;

    if (removed) {
      vscode.window.showInformationMessage(
        `Removed deleted file from analysis view: ${filePath}`,
      );
    }

    this.refreshViews();
  }

  /**
   * Refreshes both the SmellsViewProvider and MetricsViewProvider.
   */
  private refreshViews(): void {
    this.smellsViewProvider.refresh();
    this.metricsViewProvider.refresh();
  }

  /**
   * Disposes of the file watcher and save listener to clean up resources.
   */
  public dispose(): void {
    this.fileWatcher?.dispose();
    this.saveListener?.dispose();
  }
}
