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
  public refactoredFilePath: string | undefined;

  constructor() {}

  /**
   * Updates the refactoring details with the given file names.
   * @param refactoredFilePath - The path of the refactored file.
   * @param originalFilePath - The path of the original file.
   */
  updateRefactoringDetails(
    refactoredFilePath: string,
    originalFilePath: string,
  ): void {
    this.refactoredFilePath = refactoredFilePath;
    this.originalFilePath = originalFilePath;

    this.refactoringDetails = [
      new RefactoringDetailItem('Refactored File', refactoredFilePath, 'accept'),
      new RefactoringDetailItem('Original File', originalFilePath, 'reject'),
    ];
    this._onDidChangeTreeData.fire(undefined); // Refresh the view
  }

  /**
   * Resets the refactoring details to indicate no refactoring is in progress.
   */
  resetRefactoringDetails(): void {
    this.refactoredFilePath = undefined;
    this.originalFilePath = undefined;

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
  constructor(
    label: string,
    description: string,
    public readonly action?: 'accept' | 'reject',
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;

    if (action === 'accept') {
      this.iconPath = new vscode.ThemeIcon('check');
      this.command = {
        command: 'ecooptimizer.acceptRefactoring',
        title: 'Accept Refactoring',
      };
    } else if (action === 'reject') {
      this.iconPath = new vscode.ThemeIcon('close');
      this.command = {
        command: 'ecooptimizer.rejectRefactoring',
        title: 'Reject Refactoring',
      };
    }
  }
}
