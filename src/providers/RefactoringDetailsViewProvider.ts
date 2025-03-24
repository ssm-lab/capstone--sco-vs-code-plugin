import * as vscode from 'vscode';
import * as path from 'path';
import { getDescriptionByMessageId, getNameByMessageId } from '../utils/smellsData';

/**
 * Provides a tree view that displays detailed information about ongoing refactoring operations.
 * Shows the target smell, affected files, and estimated energy savings.
 */
export class RefactoringDetailsViewProvider
  implements vscode.TreeDataProvider<RefactoringDetailItem>
{
  // Event emitter for tree data changes
  private _onDidChangeTreeData = new vscode.EventEmitter<
    RefactoringDetailItem | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  // State properties
  private refactoringDetails: RefactoringDetailItem[] = [];
  public targetFile: { original: string; refactored: string } | undefined;
  public affectedFiles: { original: string; refactored: string }[] = [];
  public energySaved: number | undefined;
  public targetSmell: Smell | undefined;

  constructor() {
    this.resetRefactoringDetails();
  }

  /**
   * Updates the view with new refactoring details
   * @param targetSmell - The code smell being refactored
   * @param targetFile - Paths to original and refactored target files
   * @param affectedFiles - Additional files impacted by the refactoring
   * @param energySaved - Estimated energy savings in kg CO2
   */
  updateRefactoringDetails(
    targetSmell: Smell,
    targetFile: { original: string; refactored: string },
    affectedFiles: { original: string; refactored: string }[],
    energySaved: number | undefined,
  ): void {
    this.targetSmell = targetSmell;
    this.targetFile = targetFile;
    this.affectedFiles = affectedFiles;
    this.energySaved = energySaved;
    this.refactoringDetails = [];

    // Add smell information
    if (targetSmell) {
      const smellName =
        getNameByMessageId(targetSmell.messageId) || targetSmell.messageId;
      this.refactoringDetails.push(
        new RefactoringDetailItem(
          `Refactoring: ${smellName}`,
          '',
          '',
          '',
          true,
          false,
          true,
        ),
      );
    }

    // Add energy savings
    if (energySaved !== undefined) {
      this.refactoringDetails.push(
        new RefactoringDetailItem(
          `Estimated Savings: ${energySaved} kg CO2`,
          'Based on energy impact analysis',
          '',
          '',
          false,
          true,
        ),
      );
    }

    // Add target file
    if (targetFile) {
      this.refactoringDetails.push(
        new RefactoringDetailItem(
          `${path.basename(targetFile.original)}`,
          'Main refactored file',
          targetFile.original,
          targetFile.refactored,
          affectedFiles.length > 0,
        ),
      );
    }

    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Resets the view to its initial state
   */
  resetRefactoringDetails(): void {
    this.targetFile = undefined;
    this.affectedFiles = [];
    this.targetSmell = undefined;
    this.energySaved = undefined;
    this.refactoringDetails = [];
    this._onDidChangeTreeData.fire(undefined);
  }

  // VS Code TreeDataProvider implementation
  getTreeItem(element: RefactoringDetailItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: RefactoringDetailItem): RefactoringDetailItem[] {
    if (!element) {
      return this.refactoringDetails;
    }

    // Handle smell description expansion
    if (element.isSmellItem && this.targetSmell) {
      const description =
        getDescriptionByMessageId(this.targetSmell.messageId) ||
        this.targetSmell.message;
      return [
        new RefactoringDetailItem(
          '',
          description,
          '',
          '',
          false,
          false,
          false,
          'info',
        ),
      ];
    }

    // Handle affected files expansion
    if (element.isParent && this.affectedFiles.length > 0) {
      return this.affectedFiles.map(
        (file) =>
          new RefactoringDetailItem(
            path.basename(file.original),
            'Affected file',
            file.original,
            file.refactored,
          ),
      );
    }

    return [];
  }
}

/**
 * Represents an item in the refactoring details tree view
 */
class RefactoringDetailItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly originalFilePath: string,
    public readonly refactoredFilePath: string,
    public readonly isParent: boolean = false,
    public readonly isEnergySaved: boolean = false,
    public readonly isSmellItem: boolean = false,
    public readonly itemType: 'info' | 'file' | 'none' = 'none',
  ) {
    super(
      label,
      isParent || isSmellItem
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );

    // Configure item based on type
    if (isEnergySaved) {
      this.iconPath = new vscode.ThemeIcon(
        'lightbulb',
        new vscode.ThemeColor('charts.yellow'),
      );
      this.tooltip = 'Estimated energy savings from this refactoring';
    } else if (isSmellItem) {
      this.iconPath = new vscode.ThemeIcon(
        'warning',
        new vscode.ThemeColor('charts.orange'),
      );
    } else if (itemType === 'info') {
      this.iconPath = new vscode.ThemeIcon('info');
    }

    // Make files clickable to open diffs
    if (originalFilePath && refactoredFilePath && itemType !== 'info') {
      this.command = {
        command: 'ecooptimizer.openDiffEditor',
        title: 'Compare Changes',
        arguments: [originalFilePath, refactoredFilePath],
      };
      this.contextValue = 'refactoringFile';
    }
  }
}
