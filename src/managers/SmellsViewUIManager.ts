import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SmellsStateManager } from './SmellsViewStateManager';

/**
 * Manages the UI representation of files, folders, and detected smells in the VS Code tree view.
 * This class handles creating tree items, assigning commands, and updating item states based on
 * the analysis status and file state (e.g., outdated, queued, passed, failed).
 */
export class SmellsUIManager {
  constructor(private stateManager: SmellsStateManager) {}

  /**
   * Creates a tree item for a given element (folder, file, or smell).
   * The tree item's appearance and behavior depend on the type of element and its current state.
   *
   * @param element - The file or folder path, or a detected smell.
   * @returns A `vscode.TreeItem` representing the element.
   */
  createTreeItem(element: string): vscode.TreeItem {
    // Retrieve the current status and smell information for the element
    const status = this.stateManager.getFileStatus(element);
    const hasSmells = this.stateManager.getSmellsForFile(element).length > 0;
    const isDirectory = fs.existsSync(element) && fs.statSync(element).isDirectory();
    const isSmellItem = !fs.existsSync(element) && !isDirectory;

    // Check if the file is outdated (needs reanalysis)
    const isOutdated =
      !isDirectory && !isSmellItem && this.stateManager.isFileOutdated(element);

    // Determine the collapsible state of the tree item
    let collapsibleState: vscode.TreeItemCollapsibleState;
    if (isDirectory) {
      collapsibleState = vscode.TreeItemCollapsibleState.Collapsed; // Folders are collapsible
    } else if (isSmellItem) {
      collapsibleState = vscode.TreeItemCollapsibleState.None; // Smells are not collapsible
    } else if (isOutdated) {
      collapsibleState = vscode.TreeItemCollapsibleState.None; // Outdated files are not collapsible
    } else {
      collapsibleState = hasSmells
        ? vscode.TreeItemCollapsibleState.Collapsed // Files with smells are collapsible
        : vscode.TreeItemCollapsibleState.None; // Files without smells are not collapsible
    }

    // Create the tree item with the element's basename and collapsible state
    const item = new vscode.TreeItem(path.basename(element), collapsibleState);

    // Customize the tree item based on its type (folder, file, or smell)
    if (isDirectory) {
      // Folders have a specific context value for styling and behavior
      item.contextValue = 'ecoOptimizerFolder';
    } else if (!isSmellItem) {
      // Files have a specific context value and can be opened
      item.contextValue = 'ecoOptimizerFile';
      this.assignOpenFileCommand(item, element); // Assign a command to open the file
      this.updateFileItem(item, status, isOutdated); // Update the item's appearance based on status

      // Add a context value for files with detected smells
      if (hasSmells && status === 'passed' && !isOutdated) {
        item.contextValue = 'ecoOptimizerFile-hasSmells';
      }
    } else {
      // Smells have a specific context value and display detailed information
      item.contextValue = 'ecoOptimizerSmell';

      // Retrieve the parent file and smell object for the smell item
      const parentFile = this.stateManager.getFileForSmell(element);
      if (parentFile) {
        const smells = this.stateManager.getSmellsForFile(parentFile);

        // Extract the smell ID from the element's label
        const idMatch = element.match(/\(([^)]+)\)/);
        const id = idMatch ? idMatch[1] : null;

        // Find the smell by its ID
        const smell = smells.find((s) => s.id === id);

        if (smell) {
          // Set the label and description for the smell item
          item.label = `${smell.messageId}: Line ${smell.occurences
            .map((o) => o.line)
            .join(', ')} (ID: ${smell.id}) `;

          // Assign a command to jump to the first occurrence of the smell in the file
          const firstLine = smell.occurences[0]?.line - 1 || 0; // Default to line 0 if no occurrences
          this.assignJumpToSmellCommand(item, parentFile, firstLine);
        }
      }

      // Set the tooltip for the smell item
      this.setSmellTooltip(item, element);
    }

    return item;
  }

  /**
   * Assigns a command to open a file when the tree item is clicked.
   *
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
   * Assigns a command to jump to a specific line in a file when the tree item is clicked.
   *
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
   * Updates the file item's appearance based on its analysis status and whether it is outdated.
   *
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
      // Mark the file as outdated with a warning icon and description
      item.description = 'outdated';
      item.iconPath = new vscode.ThemeIcon(
        'warning',
        new vscode.ThemeColor('charts.orange'),
      );
      item.tooltip = `${path.basename(this.getStatusMessage('outdated'))}`;
    } else {
      // Set the icon and tooltip based on the analysis status
      item.iconPath = this.getStatusIcon(status);
      item.tooltip = `${path.basename(
        item.label as string,
      )} (${this.getStatusMessage(status)})`;
    }
  }

  /**
   * Sets the tooltip for a smell item.
   *
   * @param item - The tree item to update.
   * @param smellDescription - The description of the smell.
   */
  private setSmellTooltip(item: vscode.TreeItem, smellDescription: string): void {
    item.tooltip = smellDescription;
  }

  /**
   * Retrieves the appropriate VS Code icon based on the smell analysis status.
   *
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
   *
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
