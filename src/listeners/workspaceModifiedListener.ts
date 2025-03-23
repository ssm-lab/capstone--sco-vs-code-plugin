import * as vscode from 'vscode';
import * as fs from 'fs';

import { SmellsCacheManager } from '../context/SmellsCacheManager';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { MetricsViewProvider } from '../providers/MetricsViewProvider';

/**
 * Listens for workspace modifications (file creation, deletion, and changes)
 * and refreshes the SmellsViewProvider and MetricsViewProvider when any of these events occur.
 */
export class WorkspaceModifiedListener {
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  private textDocumentChangeListener: vscode.Disposable | undefined;
  private pollingInterval: NodeJS.Timeout | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    private smellsCacheManager: SmellsCacheManager,
    private smellsViewProvider: SmellsViewProvider,
    private metricsViewProvider: MetricsViewProvider,
  ) {
    this.initializeFileWatcher();
    this.initializeTextDocumentListener();
    this.initializePolling();
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

    console.log('Watching workspace:', configuredPath);

    this.fileWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(configuredPath, '**/*.py'),
      false, // do not ignore create events
      false, // do not ignore change events
      false, // do not ignore delete events
    );

    this.fileWatcher.onDidCreate(() => {
      console.log('A Python file was created.');
      this.refreshViews();
    });

    this.fileWatcher.onDidChange((uri) => {
      console.log('A Python file was modified and saved.');
      this.handleFileChange(uri.fsPath);
    });

    this.fileWatcher.onDidDelete((uri) => {
      console.log('A Python file was deleted.');
      this.handleFileDeletion(uri.fsPath);
    });
  }

  /**
   * Initializes the text document change listener.
   */
  private initializeTextDocumentListener(): void {
    this.textDocumentChangeListener = vscode.workspace.onDidChangeTextDocument(
      (event) => {
        const filePath = event.document.uri.fsPath;
        if (filePath.endsWith('.py')) {
          console.log(`File ${filePath} was modified (unsaved changes).`);
          this.handleFileChange(filePath);
        }
      },
    );
  }

  /**
   * Initializes polling to detect external modifications.
   */
  private initializePolling(): void {
    const pollingIntervalMs = 5000; // Poll every 5 seconds
    this.pollingInterval = setInterval(() => {
      this.checkForExternalModifications();
    }, pollingIntervalMs);
  }

  /**
   * Checks for external modifications by comparing file modification times.
   */
  private async checkForExternalModifications(): Promise<void> {
    const configuredPath = this.context.workspaceState.get<string>(
      'workspaceConfiguredPath',
    );
    if (!configuredPath) {
      return;
    }

    const cache = this.smellsCacheManager.getFullSmellCache();
    for (const filePath in cache) {
      try {
        const stats = await fs.promises.stat(filePath);
        const lastModified = stats.mtimeMs;

        const cachedStats = this.context.workspaceState.get<number>(
          `fileStats:${filePath}`,
        );
        if (cachedStats && lastModified > cachedStats) {
          console.log(`External modification detected in file: ${filePath}`);
          this.handleFileChange(filePath);
        }

        await this.context.workspaceState.update(
          `fileStats:${filePath}`,
          lastModified,
        );
      } catch (error) {
        console.error(`Error checking file ${filePath}:`, error);
      }
    }
  }

  /**
   * Handles file changes by clearing the cache for the modified file and marking it as outdated.
   * @param filePath - The path of the modified file.
   */
  private async handleFileChange(filePath: string): Promise<void> {
    if (this.smellsCacheManager.hasCachedSmells(filePath)) {
      await this.smellsCacheManager.clearCachedSmellsForFile(filePath);
      this.smellsViewProvider.updateStatus(filePath, 'outdated');
    }
    this.refreshViews();
  }

  /**
   * Handles file deletions by clearing the cache for the deleted file and refreshing the tree view.
   * @param filePath - The path of the deleted file.
   */
  private async handleFileDeletion(filePath: string): Promise<void> {
    if (this.smellsCacheManager.hasCachedSmells(filePath)) {
      await this.smellsCacheManager.clearCachedSmellsForFile(filePath);
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
   * Disposes the file system watcher, text document listener, and polling interval.
   */
  public dispose(): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
    }
    if (this.textDocumentChangeListener) {
      this.textDocumentChangeListener.dispose();
    }
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }
}
