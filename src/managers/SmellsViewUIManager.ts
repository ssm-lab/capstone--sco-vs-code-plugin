import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SmellsStateManager } from './SmellsViewStateManager';

export class SmellsUIManager {
  constructor(private stateManager: SmellsStateManager) {}

  /**
   * Creates a tree item for a given element (folder, file, or smell).
   * @param element - The file or folder path, or a detected smell.
   */
  createTreeItem(element: string): vscode.TreeItem {
    const status = this.stateManager.getFileStatus(element);
    const hasSmells = this.stateManager.getSmellsForFile(element).length > 0;
    const isDirectory = fs.existsSync(element) && fs.statSync(element).isDirectory();
    const isSmellItem = !fs.existsSync(element) && !isDirectory;

    // Check if the file is outdated
    const isOutdated =
      !isDirectory && !isSmellItem && this.stateManager.isFileOutdated(element);

    // Set the collapsible state
    let collapsibleState: vscode.TreeItemCollapsibleState;
    if (isDirectory) {
      // Directories are always collapsible
      collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    } else if (isSmellItem) {
      // Smell items are never collapsible
      collapsibleState = vscode.TreeItemCollapsibleState.None;
    } else if (isOutdated) {
      // Outdated files are not collapsible
      collapsibleState = vscode.TreeItemCollapsibleState.None;
    } else {
      // Files with smells are collapsible
      collapsibleState = hasSmells
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;
    }

    const item = new vscode.TreeItem(path.basename(element), collapsibleState);

    if (isDirectory) {
      item.contextValue = 'ecoOptimizerFolder';
    } else if (!isSmellItem) {
      item.contextValue = 'ecoOptimizerFile';
      this.assignOpenFileCommand(item, element);
      this.updateFileItem(item, status, isOutdated);

      // Add a context value for files with smells
      if (hasSmells && status === 'passed') {
        item.contextValue = 'ecoOptimizerFile-hasSmells'; // Append 'hasSmells' to the context value
      }
    } else {
      item.contextValue = 'ecoOptimizerSmell';
      const parentFile = this.stateManager.getFileForSmell(element);
      if (parentFile) {
        const [, lineStr] = element.split(': Line ');
        const lines = lineStr.split(',').map((line) => parseInt(line.trim(), 10));
        const firstLine = lines.length > 0 ? lines[0] - 1 : 0;
        this.assignJumpToSmellCommand(item, parentFile, firstLine);
      }
      this.setSmellTooltip(item, element);
    }

    return item;
  }

  /**
   * Assigns a command to open a file when the tree item is clicked.
   * @param item - The tree item to update.
   * @param filePath - The path of the file to open.
   */
  private assignOpenFileCommand(item: vscode.TreeItem, filePath: string): void {
    item.command = {
      command: 'ecooptimizer.openFile',
      title: 'Open File',
      arguments: [vscode.Uri.file(filePath)],
    };
  }

  /**
   * Updates the file item's status, including icon, message, and description.
   * @param item - The tree item to update.
   * @param status - The analysis status (e.g., "queued", "passed", "failed", "outdated").
   * @param isOutdated - Whether the file is outdated.
   */
  private updateFileItem(
    item: vscode.TreeItem,
    status: string,
    isOutdated: boolean,
  ): void {
    if (isOutdated) {
      item.description = 'outdated';
      item.iconPath = new vscode.ThemeIcon(
        'warning',
        new vscode.ThemeColor('charts.orange'),
      );
    } else {
      item.iconPath = this.getStatusIcon(status);
    }
    item.tooltip = `${path.basename(
      item.label as string,
    )} (${this.getStatusMessage(status)})`;
  }

  /**
   * Assigns a command to jump to a specific line in a file when the tree item is clicked.
   * @param item - The tree item to update.
   * @param filePath - The path of the file containing the smell.
   * @param line - The line number to jump to.
   */
  private assignJumpToSmellCommand(
    item: vscode.TreeItem,
    filePath: string,
    line: number,
  ): void {
    item.command = {
      command: 'ecooptimizer.jumpToSmell',
      title: 'Jump to Smell',
      arguments: [filePath, line],
    };
  }

  /**
   * Sets the tooltip for a smell item.
   * @param item - The tree item to update.
   * @param smellDescription - The description of the smell.
   */
  private setSmellTooltip(item: vscode.TreeItem, smellDescription: string): void {
    item.tooltip = smellDescription;
  }

  /**
   * Retrieves the appropriate VS Code icon based on the smell analysis status.
   * @param status - The analysis status.
   * @returns The corresponding VS Code theme icon.
   */
  private getStatusIcon(status: string): vscode.ThemeIcon {
    switch (status) {
      case 'queued':
        return new vscode.ThemeIcon(
          'sync~spin',
          new vscode.ThemeColor('charts.yellow'),
        );
      case 'passed':
        return new vscode.ThemeIcon('pass', new vscode.ThemeColor('charts.green'));
      case 'no_issues':
        return new vscode.ThemeIcon('pass', new vscode.ThemeColor('charts.blue'));
      case 'failed':
        return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
      case 'outdated':
        return new vscode.ThemeIcon(
          'warning',
          new vscode.ThemeColor('charts.orange'),
        );
      case 'server_down':
        return new vscode.ThemeIcon(
          'server-process',
          new vscode.ThemeColor('charts.red'),
        );
      default:
        return new vscode.ThemeIcon('circle-outline');
    }
  }

  /**
   * Retrieves the status message corresponding to the smell analysis state.
   * @param status - The analysis status.
   * @returns A descriptive status message.
   */
  private getStatusMessage(status: string): string {
    switch (status) {
      case 'queued':
        return 'Analyzing Smells';
      case 'passed':
        return 'Smells Successfully Detected';
      case 'failed':
        return 'Error Detecting Smells';
      case 'no_issues':
        return 'No Smells Found';
      case 'outdated':
        return 'File Outdated - Needs Reanalysis';
      case 'server_down':
        return 'Server Unavailable';
      default:
        return 'Smells Not Yet Detected';
    }
  }
}
