import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class SmellsViewProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | void> =
    new vscode.EventEmitter<TreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    const rootPath = this.context.workspaceState.get<string>(
      'workspaceConfiguredPath',
    );
    if (!rootPath) {
      return [];
    }

    // Root level
    if (!element) {
      const stat = fs.statSync(rootPath);
      if (stat.isFile()) {
        return [this.createTreeItem(rootPath, true)];
      } else if (stat.isDirectory()) {
        return this.readDirectory(rootPath);
      }
    }

    // Nested level (directory)
    if (element && element.resourceUri) {
      return this.readDirectory(element.resourceUri.fsPath);
    }

    return [];
  }

  private readDirectory(dirPath: string): TreeItem[] {
    const children: TreeItem[] = [];

    try {
      const entries = fs.readdirSync(dirPath);
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stat = fs.statSync(fullPath);

        // If directory, always include
        if (stat.isDirectory()) {
          children.push(this.createTreeItem(fullPath, false));
        }
        // If file, only include if it's a .py file
        else if (stat.isFile() && entry.endsWith('.py')) {
          children.push(this.createTreeItem(fullPath, true));
        }
      }
    } catch (err) {
      console.error(`Failed to read directory ${dirPath}:`, err);
    }

    return children;
  }

  private createTreeItem(filePath: string, isFile: boolean): TreeItem {
    const label = path.basename(filePath);
    const collapsibleState = isFile
      ? vscode.TreeItemCollapsibleState.None
      : vscode.TreeItemCollapsibleState.Collapsed;

    const contextValue = isFile ? 'file' : 'directory';

    return new TreeItem(label, filePath, collapsibleState, contextValue);
  }
}

class TreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly fullPath: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    contextValue: string,
  ) {
    super(label, collapsibleState);
    this.resourceUri = vscode.Uri.file(fullPath);
    this.contextValue = contextValue;
  }
}
