import * as vscode from 'vscode';
import * as path from 'path';

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
  public energySaved: number | null = null; // Add energySaved as a class property

  constructor() {
    this.resetRefactoringDetails();
  }

  /**
   * Updates the refactoring details with the given target file, affected files, and energy saved.
   * @param targetFile - The target file (original and refactored paths).
   * @param affectedFiles - The list of affected files (original and refactored paths).
   * @param energySaved - The amount of energy saved in kg CO2.
   */
  updateRefactoringDetails(
    targetFile: { original: string; refactored: string },
    affectedFiles: { original: string; refactored: string }[],
    energySaved: number | null,
  ): void {
    this.targetFile = targetFile;
    this.affectedFiles = affectedFiles;
    this.energySaved = energySaved;

    // Clear the existing refactoring details
    this.refactoringDetails = [];

    // Add energy saved as the first item
    if (energySaved !== null) {
      this.refactoringDetails.push(
        new RefactoringDetailItem(
          `Energy Saved: ${energySaved} kg CO2`, // Label
          '', // No description
          '', // No file path
          '', // No file path
          false, // Not collapsible
          true, // Special item for energy saved
        ),
      );
    }

    // Add the target file
    this.refactoringDetails.push(
      new RefactoringDetailItem(
        path.basename(targetFile.original), // File name as label
        'Target File', // Description
        targetFile.original,
        targetFile.refactored,
        true, // This is a parent item (collapsible)
      ),
    );

    // Do not add affected files to refactoringDetails here
    // They will be added dynamically in getChildren when the parent item is expanded

    this._onDidChangeTreeData.fire(undefined); // Refresh the view
  }

  /**
   * Resets the refactoring details to indicate no refactoring is in progress.
   */
  resetRefactoringDetails(): void {
    this.targetFile = undefined;
    this.affectedFiles = [];
    this.energySaved = null;
    this.refactoringDetails = [];
    this._onDidChangeTreeData.fire(undefined); // Refresh the view
  }

  getTreeItem(element: RefactoringDetailItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: RefactoringDetailItem): RefactoringDetailItem[] {
    if (element) {
      // If this is the parent item (Target File), return the affected files as children
      if (element.isParent) {
        return this.affectedFiles.map(
          (file) =>
            new RefactoringDetailItem(
              path.basename(file.original), // File name as label
              'Affected File', // Description
              file.original,
              file.refactored,
              false, // This is a child item (not collapsible)
            ),
        );
      }
      return []; // No nested items for child items
    }
    // If no element is provided, return the top-level items (Energy Saved and Target File)
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
  ) {
    super(
      label,
      isParent
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );
    this.description = description;

    // Customize the icon for the Energy Saved item
    if (isEnergySaved) {
      this.iconPath = new vscode.ThemeIcon(
        'lightbulb', // Use a lightbulb icon for energy saved
        new vscode.ThemeColor('charts.yellow'),
      );
      this.tooltip = 'This is the amount of energy saved by refactoring.';
    }

    // Add a command to open the diff editor for file items (not energy saved)
    if (!isEnergySaved) {
      this.command = {
        command: 'ecooptimizer.openDiffEditor',
        title: 'Open Diff Editor',
        arguments: [originalFilePath, refactoredFilePath],
      };
    }
  }
}
