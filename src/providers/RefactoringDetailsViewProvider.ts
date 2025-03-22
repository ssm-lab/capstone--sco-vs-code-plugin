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

  constructor() {
    // Initialize with an empty state
    this.resetRefactoringDetails();
  }

  /**
   * Updates the refactoring details with the given target file and affected files.
   * @param targetFile - The target file (original and refactored paths).
   * @param affectedFiles - The list of affected files (original and refactored paths).
   */
  updateRefactoringDetails(
    targetFile: { original: string; refactored: string },
    affectedFiles: { original: string; refactored: string }[],
  ): void {
    this.targetFile = targetFile;
    this.affectedFiles = affectedFiles;

    // Convert the absolute paths to relative paths for display
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const relativeTargetFile = workspaceFolder
      ? vscode.workspace.asRelativePath(targetFile.original)
      : targetFile.original;

    const relativeAffectedFiles = affectedFiles.map((file) =>
      workspaceFolder
        ? vscode.workspace.asRelativePath(file.original)
        : file.original,
    );

    // Create the tree view items
    this.refactoringDetails = [
      new RefactoringDetailItem(
        path.basename(targetFile.original), // File name as label
        'Target File', // Description
        targetFile.original,
        targetFile.refactored,
        true, // This is a parent item (collapsible)
      ),
    ];

    // Add affected files as child items
    if (affectedFiles.length > 0) {
      this.refactoringDetails.push(
        ...affectedFiles.map(
          (file) =>
            new RefactoringDetailItem(
              path.basename(file.original), // File name as label
              'Affected File', // Description
              file.original,
              file.refactored,
              false, // This is a child item (not collapsible)
            ),
        ),
      );
    }

    this._onDidChangeTreeData.fire(undefined); // Refresh the view
  }

  /**
   * Resets the refactoring details to indicate no refactoring is in progress.
   */
  resetRefactoringDetails(): void {
    this.targetFile = undefined;
    this.affectedFiles = [];

    // Clear the tree view
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
    // If no element is provided, return the parent item (Target File)
    return this.refactoringDetails.filter((item) => item.isParent);
  }
}

class RefactoringDetailItem extends vscode.TreeItem {
  constructor(
    label: string, // File name
    description: string, // "Target File" or "Affected File"
    public readonly originalFilePath: string,
    public readonly refactoredFilePath: string,
    public readonly isParent: boolean = false, // Whether this is a parent item
  ) {
    super(
      label,
      isParent
        ? vscode.TreeItemCollapsibleState.Collapsed // Parent item is collapsible
        : vscode.TreeItemCollapsibleState.None, // Child item is not collapsible
    );
    this.description = description; // Set the description

    // Add a command to open the diff editor for both parent and child items
    this.command = {
      command: 'ecooptimizer.openDiffEditor',
      title: 'Open Diff Editor',
      arguments: [originalFilePath, refactoredFilePath],
    };
  }
}
