import * as vscode from 'vscode';
import path from 'path';

import { SmellsCacheManager } from '../context/SmellsCacheManager';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { MetricsViewProvider } from '../providers/MetricsViewProvider';
import { ecoOutput } from '../extension';

/**
 * Monitors workspace modifications and maintains analysis state consistency by:
 * - Tracking file system changes (create/change/delete)
 * - Handling document save events
 * - Managing cache invalidation
 * - Coordinating view updates
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
    ecoOutput.appendLine(
      '[WorkspaceListener] Initialized workspace modification listener',
    );
  }

  /**
   * Creates file system watcher for Python files in configured workspace
   */
  private initializeFileWatcher(): void {
    const configuredPath = this.context.workspaceState.get<string>(
      'workspaceConfiguredPath',
    );
    if (!configuredPath) {
      ecoOutput.appendLine(
        '[WorkspaceListener] No workspace configured - skipping file watcher',
      );
      return;
    }

    try {
      this.fileWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(configuredPath, '**/*.py'),
        false, // Watch create events
        false, // Watch change events
        false, // Watch delete events
      );

      this.fileWatcher.onDidCreate(() => {
        ecoOutput.appendLine('[WorkspaceListener] Detected new Python file');
        this.refreshViews();
      });

      this.fileWatcher.onDidChange((uri) => {
        ecoOutput.appendLine(
          `[WorkspaceListener] Detected changes in ${uri.fsPath}`,
        );
        this.handleFileChange(uri.fsPath);
      });

      this.fileWatcher.onDidDelete((uri) => {
        ecoOutput.appendLine(
          `[WorkspaceListener] Detected deletion of ${uri.fsPath}`,
        );
        this.handleFileDeletion(uri.fsPath);
      });

      ecoOutput.appendLine(
        `[WorkspaceListener] Watching Python files in ${configuredPath}`,
      );
    } catch (error) {
      ecoOutput.appendLine(
        `[WorkspaceListener] Error initializing file watcher: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Sets up document save listener for Python files
   */
  private initializeSaveListener(): void {
    this.saveListener = vscode.workspace.onDidSaveTextDocument((document) => {
      if (document.languageId === 'python') {
        ecoOutput.appendLine(
          `[WorkspaceListener] Detected save in ${document.uri.fsPath}`,
        );
        this.handleFileChange(document.uri.fsPath);
      }
    });
  }

  /**
   * Handles file modifications by:
   * - Invalidating cached analysis if exists
   * - Marking file as outdated in UI
   * @param filePath - Absolute path to modified file
   */
  private async handleFileChange(filePath: string): Promise<void> {
    const hadCache = this.smellsCacheManager.hasCachedSmells(filePath);
    if (!hadCache) {
      ecoOutput.appendLine(
        `[WorkspaceListener] No cache to invalidate for ${filePath}`,
      );
      return;
    }

    try {
      await this.smellsCacheManager.clearCachedSmellsForFile(filePath);
      this.smellsViewProvider.setStatus(filePath, 'outdated');

      ecoOutput.appendLine(
        `[WorkspaceListener] Invalidated cache for modified file: ${filePath}`,
      );
      vscode.window.showInformationMessage(
        `Analysis data marked outdated for ${path.basename(filePath)}`,
        { modal: false },
      );

      this.refreshViews();
    } catch (error) {
      ecoOutput.appendLine(
        `[WorkspaceListener] Error handling file change: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Handles file deletions by:
   * - Clearing related cache entries
   * - Removing from UI views
   * @param filePath - Absolute path to deleted file
   */
  private async handleFileDeletion(filePath: string): Promise<void> {
    const hadCache = this.smellsCacheManager.hasCachedSmells(filePath);
    let removed = false;

    if (hadCache) {
      try {
        await this.smellsCacheManager.clearCachedSmellsByPath(filePath);
        removed = true;
        ecoOutput.appendLine(
          `[WorkspaceListener] Cleared cache for deleted file: ${filePath}`,
        );
      } catch (error) {
        ecoOutput.appendLine(
          `[WorkspaceListener] Error clearing cache: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const removedFromTree = this.smellsViewProvider.removeFile(filePath);
    if (removedFromTree) {
      removed = true;
      ecoOutput.appendLine(`[WorkspaceListener] Removed from view: ${filePath}`);
    }

    if (removed) {
      vscode.window.showInformationMessage(
        `Removed analysis data for deleted file: ${path.basename(filePath)}`,
        { modal: false },
      );
    }

    this.refreshViews();
  }

  /**
   * Triggers refresh of all dependent views
   */
  private refreshViews(): void {
    this.smellsViewProvider.refresh();
    this.metricsViewProvider.refresh();
    ecoOutput.appendLine('[WorkspaceListener] Refreshed all views');
  }

  /**
   * Cleans up resources including:
   * - File system watcher
   * - Document save listener
   */
  public dispose(): void {
    this.fileWatcher?.dispose();
    this.saveListener?.dispose();
    ecoOutput.appendLine('[WorkspaceListener] Disposed all listeners');
  }
}
