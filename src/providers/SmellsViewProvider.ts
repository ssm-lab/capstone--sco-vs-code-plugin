import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SmellsStateManager } from '../managers/SmellsViewStateManager';
import { SmellsUIManager } from '../managers/SmellsViewUIManager';

export class SmellsViewProvider implements vscode.TreeDataProvider<string> {
  private _onDidChangeTreeData = new vscode.EventEmitter<string | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private stateManager: SmellsStateManager;
  private uiManager: SmellsUIManager;

  constructor(private context: vscode.ExtensionContext) {
    this.stateManager = new SmellsStateManager();
    this.uiManager = new SmellsUIManager(this.stateManager);
  }

  /**
   * Refreshes the tree view, triggering a UI update.
   */
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Returns a tree item representing a file, folder, or detected smell.
   * @param element - The file or folder path, or a detected smell.
   */
  getTreeItem(element: string): vscode.TreeItem {
    return this.uiManager.createTreeItem(element);
  }

  /**
   * Retrieves child elements for a given tree item.
   * @param element - The parent tree item (optional).
   */
  async getChildren(element?: string): Promise<string[]> {
    if (!element) {
      const configuredPath = this.context.workspaceState.get<string>(
        'workspaceConfiguredPath',
      );
      return configuredPath ? [configuredPath] : [];
    }

    const isDirectory = fs.existsSync(element) && fs.statSync(element).isDirectory();

    if (isDirectory) {
      return fs
        .readdirSync(element)
        .filter((file) => file.endsWith('.py'))
        .map((file) => path.join(element, file));
    }

    // Check if the file is outdated
    if (this.stateManager.isFileOutdated(element)) {
      return []; // Return an empty array if the file is outdated
    }

    // If the file is not outdated, return the detected smells
    const smells = this.stateManager.getSmellsForFile(element);
    return smells.map((smell) => {
      const smellItem = `${smell.acronym}: Line ${smell.occurrences
        .map((o) => o.line)
        .join(', ')}`;
      this.stateManager.mapSmellToFile(smellItem, element);
      return smellItem;
    });
  }

  /**
   * Updates the detected smells for a file and refreshes the tree view.
   * @param filePath - The analyzed file path.
   * @param smells - The detected smells in the file.
   * @param smellMetadata - Metadata containing message ID and acronym for each smell.
   */
  updateSmells(
    filePath: string,
    smells: Smell[],
    smellMetadata: Record<string, { message_id: string; acronym: string }>,
  ): void {
    this.stateManager.updateSmells(filePath, smells, smellMetadata);
    this.refresh();
  }

  /**
   * Marks a file as outdated, updating its appearance in the UI.
   * @param filePath - The path of the modified file.
   */
  markFileAsOutdated(filePath: string): void {
    this.stateManager.markFileAsOutdated(filePath);
    this.refresh();
  }

  /**
   * Updates the status of a specific file or folder.
   * @param element - The file or folder path.
   * @param status - The new status to set.
   */
  updateStatus(element: string, status: string): void {
    this.stateManager.updateFileStatus(element, status);
    this.refresh();
  }

  /**
   * Clears the outdated status for a file.
   * @param filePath - The path of the file to clear.
   */
  clearOutdatedStatus(filePath: string): void {
    this.stateManager.clearOutdatedStatus(filePath);
    this.refresh();
  }

  /**
   * Checks if a file is marked as outdated.
   * @param filePath - The path of the file to check.
   * @returns `true` if the file is outdated, `false` otherwise.
   */
  isFileOutdated(filePath: string): boolean {
    return this.stateManager.isFileOutdated(filePath);
  }

  /**
   * Clears all detected smells and resets file statuses.
   */
  resetAllSmells(): void {
    this.stateManager.resetAllSmells();
    this.refresh();
  }
}
