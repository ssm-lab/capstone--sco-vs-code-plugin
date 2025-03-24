import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getStatusIcon, getStatusMessage } from '../utils/fileStatus';
import { buildPythonTree } from '../utils/TreeStructureBuilder';
import { getAcronymByMessageId } from '../utils/smellsData';
import { ecoOutput } from '../extension';

export class SmellsViewProvider
  implements vscode.TreeDataProvider<TreeItem | SmellTreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    TreeItem | SmellTreeItem | undefined | void
  > = new vscode.EventEmitter<TreeItem | SmellTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<
    TreeItem | SmellTreeItem | undefined | void
  > = this._onDidChangeTreeData.event;

  private fileStatuses: Map<string, string> = new Map();
  private fileSmells: Map<string, Smell[]> = new Map();

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  setStatus(filePath: string, status: string): void {
    this.fileStatuses.set(filePath, status);

    if (status === 'outdated') {
      this.fileSmells.delete(filePath);
    }

    this._onDidChangeTreeData.fire();
  }

  setSmells(filePath: string, smells: Smell[]): void {
    this.fileSmells.set(filePath, smells);
    this._onDidChangeTreeData.fire();
  }

  public removeFile(filePath: string): boolean {
    const exists = this.fileStatuses.has(filePath);
    if (exists) {
      this.fileStatuses.delete(filePath);
      this.fileSmells.delete(filePath);
    }
    return exists;
  }

  public clearAllStatuses(): void {
    this.fileStatuses.clear();
    this.fileSmells.clear();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem | SmellTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(
    element?: TreeItem | SmellTreeItem,
  ): Promise<(TreeItem | SmellTreeItem)[]> {
    const rootPath = this.context.workspaceState.get<string>(
      'workspaceConfiguredPath',
    );
    if (!rootPath) {
      ecoOutput.appendLine('No workspace configured.');
      return [];
    }

    // Smell nodes never have children
    if (element instanceof SmellTreeItem) {
      ecoOutput.appendLine('SmellTreeItem has no children.');
      return [];
    }

    // If file node, show smells
    if (
      element?.contextValue === 'file' ||
      element?.contextValue === 'file_with_smells'
    ) {
      ecoOutput.appendLine(`Getting smells for file: ${element.fullPath}`);
      const smells = this.fileSmells.get(element.fullPath) ?? [];
      return smells.map((smell) => new SmellTreeItem(smell));
    }

    // If root element (first load)
    if (!element) {
      const stat = fs.statSync(rootPath);
      if (stat.isFile()) {
        ecoOutput.appendLine(`Root is a file: ${rootPath}`);
        return [this.createTreeItem(rootPath, true)];
      } else if (stat.isDirectory()) {
        ecoOutput.appendLine(`Root is a directory: ${rootPath}`);
        return [this.createTreeItem(rootPath, false)]; // 👈 Show the root folder as the top node
      }
    }

    // Folder node – get its children
    const currentPath = element?.resourceUri?.fsPath;
    if (!currentPath) return [];

    ecoOutput.appendLine(`Getting children of folder: ${currentPath}`);
    const childNodes = buildPythonTree(currentPath);
    ecoOutput.appendLine(`  Found ${childNodes.length} children.`);
    childNodes.forEach((node) =>
      ecoOutput.appendLine(`    - ${node.fullPath} (isFile: ${node.isFile})`),
    );

    return childNodes.map(({ fullPath, isFile }) =>
      this.createTreeItem(fullPath, isFile),
    );
  }

  private createTreeItem(filePath: string, isFile: boolean): TreeItem {
    const label = path.basename(filePath);
    const status = this.fileStatuses.get(filePath) ?? 'not_yet_detected';
    const icon = isFile ? getStatusIcon(status) : new vscode.ThemeIcon('folder');
    const tooltip = isFile ? getStatusMessage(status) : undefined;

    const collapsibleState = isFile
      ? this.fileSmells.has(filePath) && this.fileSmells.get(filePath)!.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
      : vscode.TreeItemCollapsibleState.Collapsed;

    const baseContext = isFile ? 'file' : 'directory';
    const item = new TreeItem(label, filePath, collapsibleState, baseContext);
    item.iconPath = icon;
    item.tooltip = tooltip;

    // Override contextValue if file has smells
    if (
      isFile &&
      this.fileSmells.has(filePath) &&
      this.fileSmells.get(filePath)!.length > 0
    ) {
      item.contextValue = 'file_with_smells';
    }

    if (status === 'outdated') {
      item.description = 'outdated';
    }

    // ✅ Log the context value
    ecoOutput.appendLine(`Created TreeItem: ${filePath}`);
    ecoOutput.appendLine(`  → Label: ${label}`);
    ecoOutput.appendLine(`  → isFile: ${isFile}`);
    ecoOutput.appendLine(`  → Context Value: ${item.contextValue}`);
    ecoOutput.appendLine(`  → Status: ${status}`);

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

    if (contextValue === 'file' || contextValue === 'file_with_smells') {
      this.command = {
        title: 'Open File',
        command: 'vscode.open',
        arguments: [this.resourceUri],
      };
    }
  }
}

export class SmellTreeItem extends vscode.TreeItem {
  constructor(public readonly smell: Smell) {
    const acronym = getAcronymByMessageId(smell.messageId) ?? smell.messageId;
    const lines = smell.occurences
      ?.map((occ) => occ.line)
      .filter((line) => line !== undefined)
      .sort((a, b) => a - b)
      .join(', ');

    const label = lines ? `${acronym}: Line ${lines}` : acronym;
    super(label, vscode.TreeItemCollapsibleState.None);

    this.tooltip = smell.message;
    this.contextValue = 'smell';
    this.iconPath = new vscode.ThemeIcon('snake');

    const firstLine = smell.occurences?.[0]?.line;
    if (smell.path && typeof firstLine === 'number') {
      this.command = {
        title: 'Jump to Smell',
        command: 'ecooptimizer.jumpToSmell',
        arguments: [smell.path, firstLine - 1],
      };
    }
  }
}
