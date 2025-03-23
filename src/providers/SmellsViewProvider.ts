import * as vscode from 'vscode';
import { getStatusIcon, getStatusMessage } from '../utils/fileStatus';
import { buildPythonTree } from '../utils/TreeStructureBuilder';

export class SmellsViewProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | void> =
    new vscode.EventEmitter<TreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private fileStatuses: Map<string, string> = new Map();

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  setStatus(filePath: string, status: string): void {
    this.fileStatuses.set(filePath, status);
    this._onDidChangeTreeData.fire();
  }

  public removeFile(filePath: string): boolean {
    const exists = this.fileStatuses.has(filePath);
    if (exists) {
      this.fileStatuses.delete(filePath);
    }
    return exists;
  }

  public clearAllStatuses(): void {
    this.fileStatuses.clear();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    const rootPath = this.context.workspaceState.get<string>(
      'workspaceConfiguredPath',
    );
    if (!rootPath) return [];

    const currentPath = element?.resourceUri?.fsPath ?? rootPath;
    const nodes = buildPythonTree(currentPath);

    return nodes.map(({ label, fullPath, isFile }) => {
      const status = this.fileStatuses.get(fullPath) ?? 'not_yet_detected';
      const icon = isFile ? getStatusIcon(status) : new vscode.ThemeIcon('folder');
      const tooltip = isFile ? getStatusMessage(status) : undefined;

      const collapsibleState = isFile
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Collapsed;

      const item = new TreeItem(
        label,
        fullPath,
        collapsibleState,
        isFile ? 'file' : 'directory',
      );
      item.iconPath = icon;
      item.tooltip = tooltip;

      // Add "Outdated" description
      if (status === 'outdated') {
        item.description = 'outdated';
      }

      return item;
    });
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

    if (contextValue === 'file') {
      this.command = {
        title: 'Open File',
        command: 'vscode.open',
        arguments: [this.resourceUri],
      };
    }
  }
}
