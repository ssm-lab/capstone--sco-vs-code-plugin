import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { buildPythonTree } from '../utils/TreeStructureBuilder';
import { getAcronymByMessageId } from '../utils/smellsData';
import { normalizePath } from '../utils/normalizePath';
import { envConfig } from '../utils/envConfig';

/**
 * Provides a tree view for displaying code smells in the workspace.
 * Shows files and their detected smells in a hierarchical structure,
 * with status indicators and navigation capabilities.
 */
export class SmellsViewProvider
  implements vscode.TreeDataProvider<TreeItem | SmellTreeItem>
{
  // Event emitter for tree view updates
  private _onDidChangeTreeData: vscode.EventEmitter<
    TreeItem | SmellTreeItem | undefined | void
  > = new vscode.EventEmitter<TreeItem | SmellTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<
    TreeItem | SmellTreeItem | undefined | void
  > = this._onDidChangeTreeData.event;

  // Tracks analysis status and smells for each file
  private fileStatuses: Map<string, string> = new Map();
  private fileSmells: Map<string, Smell[]> = new Map();

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Triggers a refresh of the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Updates the analysis status for a file
   * @param filePath Path to the file
   * @param status New status ('queued', 'passed', 'failed', etc.)
   */
  setStatus(filePath: string, status: string): void {
    const normalizedPath = normalizePath(filePath);
    this.fileStatuses.set(normalizedPath, status);

    // Clear smells if status is outdated
    if (status === 'outdated') {
      this.fileSmells.delete(normalizedPath);
    }

    this._onDidChangeTreeData.fire();
  }

  /**
   * Sets the detected smells for a file
   * @param filePath Path to the file
   * @param smells Array of detected smells
   */
  setSmells(filePath: string, smells: Smell[]): void {
    this.fileSmells.set(filePath, smells);
    this._onDidChangeTreeData.fire();
  }

  /**
   * Removes a file from the tree view
   * @param filePath Path to the file to remove
   * @returns Whether the file was found and removed
   */
  public removeFile(filePath: string): boolean {
    const normalizedPath = normalizePath(filePath);
    const exists = this.fileStatuses.has(normalizedPath);
    if (exists) {
      this.fileStatuses.delete(normalizedPath);
      this.fileSmells.delete(normalizedPath);
    }
    return exists;
  }

  /**
   * Clears all file statuses and smells from the view
   */
  public clearAllStatuses(): void {
    this.fileStatuses.clear();
    this.fileSmells.clear();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem | SmellTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Builds the tree view hierarchy
   * @param element The parent element or undefined for root items
   * @returns Promise resolving to child tree items
   */
  async getChildren(
    element?: TreeItem | SmellTreeItem,
  ): Promise<(TreeItem | SmellTreeItem)[]> {
    const rootPath = this.context.workspaceState.get<string>(
      envConfig.WORKSPACE_CONFIGURED_PATH!,
    );
    if (!rootPath) {
      return [];
    }

    // Smell nodes are leaf nodes - no children
    if (element instanceof SmellTreeItem) {
      return [];
    }

    // If this is a file node, show its smells
    if (
      element?.contextValue === 'file' ||
      element?.contextValue === 'file_with_smells'
    ) {
      const smells = this.fileSmells.get(element.fullPath) ?? [];
      return smells.map((smell) => new SmellTreeItem(smell));
    }

    // Root element - show either single file or folder contents
    if (!element) {
      const stat = fs.statSync(rootPath);
      if (stat.isFile()) {
        return [this.createTreeItem(rootPath, true)];
      } else if (stat.isDirectory()) {
        return [this.createTreeItem(rootPath, false)]; // Show root folder as top node
      }
    }

    // Folder node - build its contents
    const currentPath = element?.resourceUri?.fsPath;
    if (!currentPath) return [];

    const childNodes = buildPythonTree(currentPath);
    return childNodes.map(({ fullPath, isFile }) =>
      this.createTreeItem(fullPath, isFile),
    );
  }

  /**
   * Creates a tree item for a file or folder
   * @param filePath Path to the file/folder
   * @param isFile Whether this is a file (false for folders)
   * @returns Configured TreeItem instance
   */
  private createTreeItem(filePath: string, isFile: boolean): TreeItem {
    const label = path.basename(filePath);
    const status =
      this.fileStatuses.get(normalizePath(filePath)) ?? 'not_yet_detected';
    const icon = isFile ? getStatusIcon(status) : new vscode.ThemeIcon('folder');
    const tooltip = isFile ? getStatusMessage(status) : undefined;

    // Determine collapsible state:
    // - Folders are always collapsible
    // - Files are collapsible only if they have smells
    const collapsibleState = isFile
      ? this.fileSmells.has(filePath) && this.fileSmells.get(filePath)!.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
      : vscode.TreeItemCollapsibleState.Collapsed;

    const baseContext = isFile ? 'file' : 'directory';
    const item = new TreeItem(label, filePath, collapsibleState, baseContext);
    item.iconPath = icon;
    item.tooltip = tooltip;

    // Mark files with smells with special context
    if (
      isFile &&
      this.fileSmells.has(filePath) &&
      this.fileSmells.get(filePath)!.length > 0
    ) {
      item.contextValue = 'file_with_smells';
    }

    // Show outdated status in description
    if (status === 'outdated') {
      item.description = 'outdated';
    }

    return item;
  }
}

/**
 * Tree item representing a file or folder in the smells view
 */
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

    // Make files clickable to open them
    if (contextValue === 'file' || contextValue === 'file_with_smells') {
      this.command = {
        title: 'Open File',
        command: 'vscode.open',
        arguments: [this.resourceUri],
      };
    }
  }
}

/**
 * Tree item representing a detected code smell
 */
export class SmellTreeItem extends vscode.TreeItem {
  constructor(public readonly smell: Smell) {
    // Format label with acronym and line numbers
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

    // Set up command to jump to the first occurrence
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

/**
 * Gets the appropriate icon for a file's analysis status
 * @param status Analysis status string
 * @returns ThemeIcon with appropriate icon and color
 */
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
 * Gets a human-readable message for an analysis status
 * @param status Analysis status string
 * @returns Descriptive status message
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
