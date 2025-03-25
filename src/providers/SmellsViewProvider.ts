import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { buildPythonTree } from '../utils/TreeStructureBuilder';
import { getAcronymByMessageId } from '../utils/smellsData';
import { normalizePath } from '../utils/normalizePath';
import { envConfig } from '../utils/envConfig';

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
    this.fileStatuses.set(normalizePath(filePath), status);

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
    const normalizedPath = normalizePath(filePath);
    const exists = this.fileStatuses.has(normalizedPath);
    if (exists) {
      this.fileStatuses.delete(normalizedPath);
      this.fileSmells.delete(normalizedPath);
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
      envConfig.WORKSPACE_CONFIGURED_PATH!,
    );
    if (!rootPath) {
      return [];
    }

    // Smell nodes never have children
    if (element instanceof SmellTreeItem) {
      return [];
    }

    // If file node, show smells
    if (
      element?.contextValue === 'file' ||
      element?.contextValue === 'file_with_smells'
    ) {
      const smells = this.fileSmells.get(element.fullPath) ?? [];
      return smells.map((smell) => new SmellTreeItem(smell));
    }

    // If root element (first load)
    if (!element) {
      const stat = fs.statSync(rootPath);
      if (stat.isFile()) {
        return [this.createTreeItem(rootPath, true)];
      } else if (stat.isDirectory()) {
        return [this.createTreeItem(rootPath, false)]; // 👈 Show the root folder as the top node
      }
    }

    // Folder node – get its children
    const currentPath = element?.resourceUri?.fsPath;
    if (!currentPath) return [];

    const childNodes = buildPythonTree(currentPath);

    return childNodes.map(({ fullPath, isFile }) =>
      this.createTreeItem(fullPath, isFile),
    );
  }

  private createTreeItem(filePath: string, isFile: boolean): TreeItem {
    const label = path.basename(filePath);
    const status =
      this.fileStatuses.get(normalizePath(filePath)) ?? 'not_yet_detected';
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

    return item;
  }
}

export class TreeItem extends vscode.TreeItem {
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

export function getStatusIcon(status: string): vscode.ThemeIcon {
  switch (status) {
    case 'queued':
      return new vscode.ThemeIcon(
        'sync~spin',
        new vscode.ThemeColor('charts.yellow'),
      );
    case 'passed':
      return new vscode.ThemeIcon('pass', new vscode.ThemeColor('charts.green'));
    case 'no_issues':
      return new vscode.ThemeIcon('pass', new vscode.ThemeColor('charts.blue'));
    case 'failed':
      return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
    case 'outdated':
      return new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.orange'));
    case 'server_down':
      return new vscode.ThemeIcon(
        'server-process',
        new vscode.ThemeColor('charts.red'),
      );
    case 'refactoring':
      return new vscode.ThemeIcon('robot', new vscode.ThemeColor('charts.purple'));
    case 'accept-refactoring':
      return new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
    default:
      return new vscode.ThemeIcon('circle-outline');
  }
}

/**
 * Retrieves the status message corresponding to the smell analysis state.
 * @param status - The analysis status.
 * @returns A descriptive status message.
 */
export function getStatusMessage(status: string): string {
  switch (status) {
    case 'queued':
      return 'Analyzing Smells';
    case 'passed':
      return 'Smells Successfully Detected';
    case 'failed':
      return 'Error Detecting Smells';
    case 'no_issues':
      return 'No Smells Found';
    case 'outdated':
      return 'File Outdated - Needs Reanalysis';
    case 'server_down':
      return 'Server Unavailable';
    case 'refactoring':
      return 'Refactoring Currently Ongoing';
    case 'accept-refactoring':
      return 'Successfully Refactored - Needs Reanalysis';
    default:
      return 'Smells Not Yet Detected';
  }
}
