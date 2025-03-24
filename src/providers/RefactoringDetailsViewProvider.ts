import * as vscode from 'vscode';
import * as path from 'path';
import { getDescriptionByMessageId, getNameByMessageId } from '../utils/smellsData';

export class RefactoringDetailsViewProvider
  implements vscode.TreeDataProvider<RefactoringDetailItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    RefactoringDetailItem | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private refactoringDetails: RefactoringDetailItem[] = [];
  public targetFile: { original: string; refactored: string } | undefined;
  public affectedFiles: { original: string; refactored: string }[] = [];
  public energySaved: number | undefined;
  public targetSmell: Smell | undefined;

  constructor() {
    this.resetRefactoringDetails();
  }

  /**
   * Updates the refactoring details with the given target file, affected files, and energy saved.
   * @param targetSmell - The smell being refactored.
   * @param targetFile - The target file (original and refactored paths).
   * @param affectedFiles - The list of affected files (original and refactored paths).
   * @param energySaved - The amount of energy saved in kg CO2.
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

    // Clear the existing refactoring details
    this.refactoringDetails = [];

    // Add the smell being refactored as the first item
    if (targetSmell) {
      const smellName =
        getNameByMessageId(targetSmell.messageId) || targetSmell.messageId;
      this.refactoringDetails.push(
        new RefactoringDetailItem(
          `Refactoring: ${smellName}`,
          '', // Empty description since we'll show it as a child
          '',
          '',
          true, // Make it collapsible to show description as child
          false,
          true, // isSmellItem
        ),
      );
    }

    // Add energy saved as the second item
    if (energySaved) {
      this.refactoringDetails.push(
        new RefactoringDetailItem(
          `Energy Saved: ${energySaved} kg CO2`,
          '',
          '',
          '',
          false,
          true, // isEnergySaved
        ),
      );
    }

    // Add the target file
    this.refactoringDetails.push(
      new RefactoringDetailItem(
        path.basename(targetFile.original),
        'Target File',
        targetFile.original,
        targetFile.refactored,
        affectedFiles.length > 0,
      ),
    );

    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Resets the refactoring details to indicate no refactoring is in progress.
   */
  resetRefactoringDetails(): void {
    this.targetFile = undefined;
    this.affectedFiles = [];
    this.targetSmell = undefined;
    this.energySaved = undefined;
    this.refactoringDetails = [];
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: RefactoringDetailItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: RefactoringDetailItem): RefactoringDetailItem[] {
    if (element) {
      // If this is the smell parent item, return the description as child
      if (element.isSmellItem && this.targetSmell) {
        const smellDescription =
          getDescriptionByMessageId(this.targetSmell.messageId) ||
          this.targetSmell.messageId;
        return [
          new RefactoringDetailItem(
            '',
            smellDescription,
            '',
            '',
            false, // Not collapsible
            false,
            false,
            'info', // New parameter for description type
          ),
        ];
      }

      // If this is the parent item (Target File), return the affected files as children
      if (element.isParent) {
        return this.affectedFiles.map(
          (file) =>
            new RefactoringDetailItem(
              path.basename(file.original),
              'Affected File',
              file.original,
              file.refactored,
              false,
            ),
        );
      }
      return [];
    }
    return this.refactoringDetails;
  }
}

class RefactoringDetailItem extends vscode.TreeItem {
  constructor(
    label: string,
    description: string,
    public readonly originalFilePath: string,
    public readonly refactoredFilePath: string,
    public readonly isParent: boolean = false,
    public readonly isEnergySaved: boolean = false,
    public readonly isSmellItem: boolean = false,
    public readonly itemType?: 'info' | 'file', // New parameter to distinguish types
  ) {
    super(
      label,
      isParent || isSmellItem // Make smell items collapsible too
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );
    this.description = description;

    // Custom icons based on type
    if (isEnergySaved) {
      this.iconPath = new vscode.ThemeIcon(
        'lightbulb',
        new vscode.ThemeColor('charts.yellow'),
      );
      this.tooltip = 'This is the amount of energy saved by refactoring.';
    } else if (isSmellItem) {
      this.iconPath = new vscode.ThemeIcon(
        'symbol-class',
        new vscode.ThemeColor('charts.'),
      );
    }

    // Add commands where appropriate
    if (!isEnergySaved && !isSmellItem && itemType !== 'info' && originalFilePath) {
      this.command = {
        command: 'ecooptimizer.openDiffEditor',
        title: 'Open Diff Editor',
        arguments: [originalFilePath, refactoredFilePath],
      };
    }
  }
}
