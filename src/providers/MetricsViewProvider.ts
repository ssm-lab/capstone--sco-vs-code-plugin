import * as vscode from 'vscode';
import * as fs from 'fs';
import { basename, dirname } from 'path';
import { buildPythonTree } from '../utils/TreeStructureBuilder';
import { envConfig } from '../utils/envConfig';
import { getFilterSmells } from '../utils/smellsData';
import { normalizePath } from '../utils/normalizePath';

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

    // Set icon based on contextValue
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

    this.description =
      carbonSaved !== undefined
        ? `Carbon Saved: ${formatNumber(carbonSaved)} kg`
        : '';
    this.tooltip = smellName || this.description;

    if (resourceUri && contextValue === 'file') {
      this.command = {
        title: 'Open File',
        command: 'vscode.open',
        arguments: [resourceUri],
      };
    }
  }
}

export interface MetricsDataItem {
  totalCarbonSaved: number;
  smellDistribution: {
    [smell: string]: number;
  };
}

interface FolderMetrics {
  totalCarbonSaved: number;
  smellDistribution: Map<string, [string, number]>; // Map<acronym, [name, carbonSaved]>
  children: {
    files: Map<string, number>; // Map<filePath, carbonSaved>
    folders: Map<string, FolderMetrics>; // Map<folderPath, FolderMetrics>
  };
}

export class MetricsViewProvider implements vscode.TreeDataProvider<MetricTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    MetricTreeItem | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private folderMetricsCache: Map<string, FolderMetrics> = new Map();

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: MetricTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: MetricTreeItem): Promise<MetricTreeItem[]> {
    const metricsData = this.context.workspaceState.get<{
      [path: string]: MetricsDataItem;
    }>(envConfig.WORKSPACE_METRICS_DATA!, {});

    if (!element) {
      const configuredPath = this.context.workspaceState.get<string>(
        envConfig.WORKSPACE_CONFIGURED_PATH!,
      );
      if (!configuredPath) return [];

      const isDirectory =
        fs.existsSync(configuredPath) && fs.statSync(configuredPath).isDirectory();
      if (isDirectory) {
        return [this.createFolderItem(configuredPath)];
      } else {
        return [this.createFileItem(configuredPath, metricsData)];
      }
    }

    if (element.contextValue === 'folder') {
      const folderPath = element.resourceUri!.fsPath;
      const folderMetrics = await this.calculateFolderMetrics(
        folderPath,
        metricsData,
      );
      const treeNodes = buildPythonTree(folderPath);

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

      const contents = treeNodes.map((node) => {
        return node.isFile
          ? this.createFileItem(node.fullPath, metricsData)
          : this.createFolderItem(node.fullPath);
      });

      return [...contents, ...folderStats];
    }

    if (element.contextValue === 'file') {
      const filePath = element.resourceUri!.fsPath;
      const fileMetrics = this.calculateFileMetrics(filePath, metricsData);
      return fileMetrics.smellData.map((data) => this.createSmellItem(data));
    }

    return [];
  }

  private createFolderItem(folderPath: string): MetricTreeItem {
    return new MetricTreeItem(
      basename(folderPath),
      vscode.TreeItemCollapsibleState.Collapsed,
      'folder',
      undefined,
      vscode.Uri.file(folderPath),
    );
  }

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

  private async calculateFolderMetrics(
    folderPath: string,
    metricsData: { [path: string]: MetricsDataItem },
  ): Promise<FolderMetrics> {
    // Check if we have cached metrics for this folder
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

    const treeNodes = buildPythonTree(folderPath);

    for (const node of treeNodes) {
      if (node.isFile) {
        const fileMetrics = this.calculateFileMetrics(node.fullPath, metricsData);
        folderMetrics.children.files.set(
          node.fullPath,
          fileMetrics.totalCarbonSaved,
        );
        folderMetrics.totalCarbonSaved += fileMetrics.totalCarbonSaved;

        for (const smellData of fileMetrics.smellData) {
          const current =
            folderMetrics.smellDistribution.get(smellData.acronym)?.[1] || 0;
          folderMetrics.smellDistribution.set(smellData.acronym, [
            smellData.name,
            current + smellData.carbonSaved,
          ]);
        }
      } else {
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

  updateMetrics(filePath: string, carbonSaved: number, smellSymbol: string): void {
    const metrics = this.context.workspaceState.get<{
      [path: string]: MetricsDataItem;
    }>(envConfig.WORKSPACE_METRICS_DATA!, {});

    const normalizedPath = normalizePath(filePath);

    if (!metrics[normalizedPath]) {
      metrics[normalizedPath] = {
        totalCarbonSaved: 0,
        smellDistribution: {},
      };
    }

    metrics[normalizedPath].totalCarbonSaved =
      (metrics[normalizedPath].totalCarbonSaved || 0) + carbonSaved;

    if (!metrics[normalizedPath].smellDistribution[smellSymbol]) {
      metrics[normalizedPath].smellDistribution[smellSymbol] = 0;
    }
    metrics[normalizedPath].smellDistribution[smellSymbol] += carbonSaved;

    this.context.workspaceState.update(envConfig.WORKSPACE_METRICS_DATA!, metrics);

    // Clear the cache for all parent folders of the updated file
    this.clearCacheForFileParents(filePath);
    this.refresh();
  }

  private clearCacheForFileParents(filePath: string): void {
    let configuredPath = this.context.workspaceState.get<string>(
      envConfig.WORKSPACE_CONFIGURED_PATH!,
    );

    if (!configuredPath) {
      return;
    }
    configuredPath = normalizePath(configuredPath);

    let currentPath = dirname(filePath);
    console.log('file affected:', filePath);

    while (currentPath.includes(configuredPath)) {
      this.folderMetricsCache.delete(currentPath);
      currentPath = dirname(currentPath);
    }
  }
}

// Helper functions
const contextPriority: { [key: string]: number } = {
  folder: 1,
  file: 2,
  smell: 3,
  'folder-stats': 4,
};

function compareTreeItems(a: MetricTreeItem, b: MetricTreeItem): number {
  const priorityA = contextPriority[a.contextValue] || 0;
  const priorityB = contextPriority[b.contextValue] || 0;
  if (priorityA !== priorityB) return priorityA - priorityB;
  return a.label.localeCompare(b.label);
}

function formatNumber(number: number, decimalPlaces: number = 2): string {
  const threshold = 0.001;
  return Math.abs(number) < threshold
    ? number.toExponential(decimalPlaces)
    : number.toFixed(decimalPlaces);
}
