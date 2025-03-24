import * as vscode from 'vscode';
import { getStatusIcon, getStatusMessage } from '../utils/fileStatus';
import { buildPythonTree } from '../utils/TreeStructureBuilder';
import { getAcronymByMessageId } from '../utils/smellsData';

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
  private fileSmells: Map<string, Smell[]> = new Map(); // Store smells for each file

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  setStatus(filePath: string, status: string): void {
    this.fileStatuses.set(filePath, status);
    this._onDidChangeTreeData.fire();
  }

  /**
   * Sets the smells for a specific file.
   * @param filePath - The path of the file.
   * @param smells - The list of smells for the file.
   */
  setSmells(filePath: string, smells: Smell[]): void {
    this.fileSmells.set(filePath, smells);
    this._onDidChangeTreeData.fire();
  }

  public removeFile(filePath: string): boolean {
    const exists = this.fileStatuses.has(filePath);
    if (exists) {
      this.fileStatuses.delete(filePath);
      this.fileSmells.delete(filePath); // Remove smells for the file as well
    }
    return exists;
  }

  public clearAllStatuses(): void {
    this.fileStatuses.clear();
    this.fileSmells.clear(); // Clear all smells
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
    if (!rootPath) return [];

    // If the element is a smell item, it has no children
    if (element instanceof SmellTreeItem) {
      return [];
    }

    const currentPath = element?.resourceUri?.fsPath ?? rootPath;
    const nodes = buildPythonTree(currentPath);

    // If the element is a file, return its smells as children
    if (element?.contextValue === 'file') {
      const smells = this.fileSmells.get(element.fullPath) ?? [];
      return smells.map((smell) => new SmellTreeItem(smell));
    }

    // Otherwise, return the files and folders
    return nodes.map(({ label, fullPath, isFile }) => {
      const status = this.fileStatuses.get(fullPath) ?? 'not_yet_detected';
      const icon = isFile ? getStatusIcon(status) : new vscode.ThemeIcon('folder');
      const tooltip = isFile ? getStatusMessage(status) : undefined;

      // Set collapsible state for files based on whether they have smells
      const collapsibleState = isFile
        ? this.fileSmells.has(fullPath) && this.fileSmells.get(fullPath)!.length > 0
          ? vscode.TreeItemCollapsibleState.Collapsed // Files with smells are collapsible
          : vscode.TreeItemCollapsibleState.None // Files without smells are not collapsible
        : vscode.TreeItemCollapsibleState.Collapsed; // Folders are always collapsible

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

/**
 * Represents a file or folder in the tree.
 */
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

/**
 * Represents a smell item in the tree.
 */
class SmellTreeItem extends vscode.TreeItem {
  constructor(public readonly smell: Smell) {
    const acronym = getAcronymByMessageId(smell.messageId) ?? smell.messageId;

    // Build the line number string: "Line 13, 18, 19"
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
  }
}
