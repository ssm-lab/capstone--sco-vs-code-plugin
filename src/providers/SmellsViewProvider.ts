import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getStatusIcon, getStatusMessage } from '../utils/fileStatus';

export class SmellsViewProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | void> =
    new vscode.EventEmitter<TreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  // File statuses (e.g. "queued", "failed", "outdated")
  private fileStatuses: Map<string, string> = new Map();

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  setStatus(filePath: string, status: string): void {
    this.fileStatuses.set(filePath, status);
    this._onDidChangeTreeData.fire(); // Trigger UI update
  }

  public removeFile(filePath: string): boolean {
    const exists = this.fileStatuses.has(filePath);
    if (exists) {
      this.fileStatuses.delete(filePath);
    }
    return exists;
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

    if (!element) {
      const stat = fs.statSync(rootPath);
      if (stat.isFile()) {
        return [this.createTreeItem(rootPath, true)];
      } else if (stat.isDirectory()) {
        return this.readDirectory(rootPath);
      }
    }

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

        if (stat.isDirectory()) {
          children.push(this.createTreeItem(fullPath, false));
        } else if (stat.isFile() && entry.endsWith('.py')) {
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

    const status = this.fileStatuses.get(filePath) ?? 'not_yet_detected'; // Default
    const icon = isFile ? getStatusIcon(status) : new vscode.ThemeIcon('folder');
    const tooltip = isFile ? getStatusMessage(status) : undefined;

    const item = new TreeItem(label, filePath, collapsibleState, contextValue);
    item.iconPath = icon;
    item.tooltip = tooltip;

    return item;
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
