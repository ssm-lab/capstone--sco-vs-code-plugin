import * as vscode from 'vscode';

export class RefactoringDetailsViewProvider
  implements vscode.TreeDataProvider<RefactoringDetailItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    RefactoringDetailItem | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private refactoringDetails: RefactoringDetailItem[] = [];
  public originalFilePath: string | undefined;
  public refactoredFilePath: string | undefined; // Add this property

  constructor() {
    // Initialize with an empty state
    this.resetRefactoringDetails();
  }

  /**
   * Updates the refactoring details with the given file names.
   * @param refactoredFilePath - The path of the refactored file.
   * @param originalFilePath - The path of the original file.
   */
  updateRefactoringDetails(
    refactoredFilePath: string,
    originalFilePath: string,
  ): void {
    this.refactoredFilePath = refactoredFilePath; // Set the refactored file path
    this.originalFilePath = originalFilePath;

    // Convert the absolute path of the original file to a relative path for display
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const relativeOriginalPath = workspaceFolder
      ? vscode.workspace.asRelativePath(originalFilePath)
      : originalFilePath;

    // Update the tree view with only the original file's relative path
    this.refactoringDetails = [
      new RefactoringDetailItem('Original File', relativeOriginalPath),
    ];
    this._onDidChangeTreeData.fire(undefined); // Refresh the view
  }

  /**
   * Resets the refactoring details to indicate no refactoring is in progress.
   */
  resetRefactoringDetails(): void {
    this.refactoredFilePath = undefined; // Reset the refactored file path
    this.originalFilePath = undefined;

    // Clear the tree view
    this.refactoringDetails = [];
    this._onDidChangeTreeData.fire(undefined); // Refresh the view
  }

  getTreeItem(element: RefactoringDetailItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: RefactoringDetailItem): RefactoringDetailItem[] {
    if (element) {
      return []; // No nested items
    }
    return this.refactoringDetails;
  }
}

class RefactoringDetailItem extends vscode.TreeItem {
  constructor(label: string, description: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;

    // Add a command to open the diff editor when the item is clicked
    this.command = {
      command: 'ecooptimizer.openDiffEditor',
      title: 'Open Diff Editor',
      arguments: [description], // Pass the file path as an argument
    };
  }
}
