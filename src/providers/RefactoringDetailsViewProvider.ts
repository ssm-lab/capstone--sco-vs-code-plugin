import * as vscode from 'vscode';

export class RefactoringDetailsViewProvider
  implements vscode.TreeDataProvider<RefactoringDetailItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    RefactoringDetailItem | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private refactoringDetails: RefactoringDetailItem[] = [];

  constructor() {}

  /**
   * Updates the refactoring details with the given file name.
   * @param fileName - The name of the refactored file.
   */
  updateRefactoringDetails(fileName: string): void {
    this.refactoringDetails = [
      new RefactoringDetailItem('Refactored File', fileName),
    ];
    this._onDidChangeTreeData.fire(undefined); // Refresh the view
  }

  /**
   * Resets the refactoring details to indicate no refactoring is in progress.
   */
  resetRefactoringDetails(): void {
    this.refactoringDetails = [
      new RefactoringDetailItem('Status', 'Refactoring not in progress'),
    ];
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
  }
}
