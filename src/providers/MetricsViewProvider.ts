import * as vscode from 'vscode';
import * as fs from 'fs';
import { basename, dirname } from 'path';
import { buildPythonTree } from '../utils/TreeStructureBuilder';
import { envConfig } from '../utils/envConfig';
import { getFilterSmells } from '../utils/smellsData';
import { normalizePath } from '../utils/normalizePath';

/**
 * Custom TreeItem for displaying metrics in the VS Code explorer
 * Handles different node types (folders, files, smells) with appropriate icons and behaviors
 */
class MetricTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly carbonSaved?: number,
    public readonly resourceUri?: vscode.Uri,
    public readonly smellName?: string,
  ) {
    super(label, collapsibleState);

    // Set icon based on node type
    switch (this.contextValue) {
      case 'folder':
        this.iconPath = new vscode.ThemeIcon('folder');
        break;
      case 'file':
        this.iconPath = new vscode.ThemeIcon('file');
        break;
      case 'smell':
        this.iconPath = new vscode.ThemeIcon('tag');
        break;
      case 'folder-stats':
        this.iconPath = new vscode.ThemeIcon('graph');
        break;
    }

    // Format carbon savings display
    this.description =
      carbonSaved !== undefined
        ? `Carbon Saved: ${formatNumber(carbonSaved)} kg`
        : '';
    this.tooltip = smellName || this.description;

    // Make files clickable to open them
    if (resourceUri && contextValue === 'file') {
      this.command = {
        title: 'Open File',
        command: 'vscode.open',
        arguments: [resourceUri],
      };
    }
  }
}

/**
 * Interface for storing metrics data for individual files
 */
export interface MetricsDataItem {
  totalCarbonSaved: number;
  smellDistribution: {
    [smell: string]: number;
  };
}

/**
 * Structure for aggregating metrics across folders
 */
interface FolderMetrics {
  totalCarbonSaved: number;
  smellDistribution: Map<string, [string, number]>; // Map<acronym, [name, carbonSaved]>
  children: {
    files: Map<string, number>; // Map<filePath, carbonSaved>
    folders: Map<string, FolderMetrics>; // Map<folderPath, FolderMetrics>
  };
}

/**
 * Provides a tree view of carbon savings metrics across the workspace
 * Aggregates data by folder structure and smell types with caching for performance
 */
export class MetricsViewProvider implements vscode.TreeDataProvider<MetricTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    MetricTreeItem | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  // Cache for folder metrics to avoid repeated calculations
  private folderMetricsCache: Map<string, FolderMetrics> = new Map();

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Triggers a refresh of the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: MetricTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Builds the tree view hierarchy
   * @param element The parent element or undefined for root items
   * @returns Promise resolving to child tree items
   */
  async getChildren(element?: MetricTreeItem): Promise<MetricTreeItem[]> {
    const metricsData = this.context.workspaceState.get<{
      [path: string]: MetricsDataItem;
    }>(envConfig.WORKSPACE_METRICS_DATA!, {});

    // Root level items
    if (!element) {
      const configuredPath = this.context.workspaceState.get<string>(
        envConfig.WORKSPACE_CONFIGURED_PATH!,
      );
      if (!configuredPath) return [];

      // Show either single file or folder contents at root
      const isDirectory =
        fs.existsSync(configuredPath) && fs.statSync(configuredPath).isDirectory();
      if (isDirectory) {
        return [this.createFolderItem(configuredPath)];
      } else {
        return [this.createFileItem(configuredPath, metricsData)];
      }
    }

    // Folder contents
    if (element.contextValue === 'folder') {
      const folderPath = element.resourceUri!.fsPath;
      const folderMetrics = await this.calculateFolderMetrics(
        folderPath,
        metricsData,
      );
      const treeNodes = buildPythonTree(folderPath);

      // Create folder statistics section
      const folderStats = [
        new MetricTreeItem(
          `Total Carbon Saved: ${formatNumber(folderMetrics.totalCarbonSaved)} kg`,
          vscode.TreeItemCollapsibleState.None,
          'folder-stats',
        ),
        ...Array.from(folderMetrics.smellDistribution.entries()).map(
          ([acronym, [name, carbonSaved]]) =>
            this.createSmellItem({ acronym, name, carbonSaved }),
        ),
      ].sort(compareTreeItems);

      // Create folder contents listing
      const contents = treeNodes.map((node) => {
        return node.isFile
          ? this.createFileItem(node.fullPath, metricsData)
          : this.createFolderItem(node.fullPath);
      });

      return [...contents, ...folderStats];
    }

    // File smell breakdown
    if (element.contextValue === 'file') {
      const filePath = element.resourceUri!.fsPath;
      const fileMetrics = this.calculateFileMetrics(filePath, metricsData);
      return fileMetrics.smellData.map((data) => this.createSmellItem(data));
    }

    return [];
  }

  /**
   * Creates a folder tree item
   */
  private createFolderItem(folderPath: string): MetricTreeItem {
    return new MetricTreeItem(
      basename(folderPath),
      vscode.TreeItemCollapsibleState.Collapsed,
      'folder',
      undefined,
      vscode.Uri.file(folderPath),
    );
  }

  /**
   * Creates a file tree item with carbon savings
   */
  private createFileItem(
    filePath: string,
    metricsData: { [path: string]: MetricsDataItem },
  ): MetricTreeItem {
    const fileMetrics = this.calculateFileMetrics(filePath, metricsData);
    return new MetricTreeItem(
      basename(filePath),
      vscode.TreeItemCollapsibleState.Collapsed,
      'file',
      fileMetrics.totalCarbonSaved,
      vscode.Uri.file(filePath),
    );
  }

  /**
   * Creates a smell breakdown item
   */
  private createSmellItem(data: {
    acronym: string;
    name: string;
    carbonSaved: number;
  }): MetricTreeItem {
    return new MetricTreeItem(
      `${data.acronym}: ${formatNumber(data.carbonSaved)} kg`,
      vscode.TreeItemCollapsibleState.None,
      'smell',
      undefined,
      undefined,
      data.name,
    );
  }

  /**
   * Calculates aggregated metrics for a folder and its contents
   * Uses caching to optimize performance for large folder structures
   */
  private async calculateFolderMetrics(
    folderPath: string,
    metricsData: { [path: string]: MetricsDataItem },
  ): Promise<FolderMetrics> {
    // Return cached metrics if available
    const cachedMetrics = this.folderMetricsCache.get(folderPath);
    if (cachedMetrics) {
      return cachedMetrics;
    }

    const folderMetrics: FolderMetrics = {
      totalCarbonSaved: 0,
      smellDistribution: new Map(),
      children: {
        files: new Map(),
        folders: new Map(),
      },
    };

    // Build directory tree structure
    const treeNodes = buildPythonTree(folderPath);

    for (const node of treeNodes) {
      if (node.isFile) {
        // Aggregate file metrics
        const fileMetrics = this.calculateFileMetrics(node.fullPath, metricsData);
        folderMetrics.children.files.set(
          node.fullPath,
          fileMetrics.totalCarbonSaved,
        );
        folderMetrics.totalCarbonSaved += fileMetrics.totalCarbonSaved;

        // Aggregate smell distribution from file
        for (const smellData of fileMetrics.smellData) {
          const current =
            folderMetrics.smellDistribution.get(smellData.acronym)?.[1] || 0;
          folderMetrics.smellDistribution.set(smellData.acronym, [
            smellData.name,
            current + smellData.carbonSaved,
          ]);
        }
      } else {
        // Recursively process subfolders
        const subFolderMetrics = await this.calculateFolderMetrics(
          node.fullPath,
          metricsData,
        );
        folderMetrics.children.folders.set(node.fullPath, subFolderMetrics);
        folderMetrics.totalCarbonSaved += subFolderMetrics.totalCarbonSaved;

        // Aggregate smell distribution from subfolder
        subFolderMetrics.smellDistribution.forEach(
          ([name, carbonSaved], acronym) => {
            const current = folderMetrics.smellDistribution.get(acronym)?.[1] || 0;
            folderMetrics.smellDistribution.set(acronym, [
              name,
              current + carbonSaved,
            ]);
          },
        );
      }
    }

    // Cache the calculated metrics
    this.folderMetricsCache.set(folderPath, folderMetrics);
    return folderMetrics;
  }

  /**
   * Calculates metrics for a single file
   */
  private calculateFileMetrics(
    filePath: string,
    metricsData: { [path: string]: MetricsDataItem },
  ): {
    totalCarbonSaved: number;
    smellData: { acronym: string; name: string; carbonSaved: number }[];
  } {
    const smellConfigData = getFilterSmells();
    const fileData = metricsData[normalizePath(filePath)] || {
      totalCarbonSaved: 0,
      smellDistribution: {},
    };

    // Filter smell distribution to only include enabled smells
    const smellDistribution = Object.keys(smellConfigData).reduce(
      (acc, symbol) => {
        if (smellConfigData[symbol]) {
          acc[symbol] = fileData.smellDistribution[symbol] || 0;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalCarbonSaved: fileData.totalCarbonSaved,
      smellData: Object.entries(smellDistribution).map(([symbol, carbonSaved]) => ({
        acronym: smellConfigData[symbol].acronym,
        name: smellConfigData[symbol].name,
        carbonSaved,
      })),
    };
  }

  /**
   * Updates metrics for a file when new analysis results are available
   */
  updateMetrics(filePath: string, carbonSaved: number, smellSymbol: string): void {
    const metrics = this.context.workspaceState.get<{
      [path: string]: MetricsDataItem;
    }>(envConfig.WORKSPACE_METRICS_DATA!, {});

    const normalizedPath = normalizePath(filePath);

    // Initialize metrics if they don't exist
    if (!metrics[normalizedPath]) {
      metrics[normalizedPath] = {
        totalCarbonSaved: 0,
        smellDistribution: {},
      };
    }

    // Update metrics
    metrics[normalizedPath].totalCarbonSaved =
      (metrics[normalizedPath].totalCarbonSaved || 0) + carbonSaved;

    if (!metrics[normalizedPath].smellDistribution[smellSymbol]) {
      metrics[normalizedPath].smellDistribution[smellSymbol] = 0;
    }
    metrics[normalizedPath].smellDistribution[smellSymbol] += carbonSaved;

    // Persist changes
    this.context.workspaceState.update(envConfig.WORKSPACE_METRICS_DATA!, metrics);

    // Clear cache for all parent folders
    this.clearCacheForFileParents(filePath);
    this.refresh();
  }

  /**
   * Clears cached metrics for all parent folders of a modified file
   */
  private clearCacheForFileParents(filePath: string): void {
    let configuredPath = this.context.workspaceState.get<string>(
      envConfig.WORKSPACE_CONFIGURED_PATH!,
    );

    if (!configuredPath) {
      return;
    }
    configuredPath = normalizePath(configuredPath);

    // Walk up the directory tree clearing cache
    let currentPath = dirname(filePath);
    while (currentPath.includes(configuredPath)) {
      this.folderMetricsCache.delete(currentPath);
      currentPath = dirname(currentPath);
    }
  }
}

// ===========================================================
//                    HELPER FUNCTIONS
// ===========================================================

/**
 * Priority for sorting tree items by type
 */
const contextPriority: { [key: string]: number } = {
  folder: 1,
  file: 2,
  smell: 3,
  'folder-stats': 4,
};

/**
 * Comparator for tree items (folders first, then files, then smells)
 */
function compareTreeItems(a: MetricTreeItem, b: MetricTreeItem): number {
  const priorityA = contextPriority[a.contextValue] || 0;
  const priorityB = contextPriority[b.contextValue] || 0;
  if (priorityA !== priorityB) return priorityA - priorityB;
  return a.label.localeCompare(b.label);
}

/**
 * Formats numbers for display, using scientific notation for very small values
 */
function formatNumber(number: number, decimalPlaces: number = 2): string {
  const threshold = 0.001;
  return Math.abs(number) < threshold
    ? number.toExponential(decimalPlaces)
    : number.toFixed(decimalPlaces);
}
