import * as vscode from 'vscode';
import * as fs from 'fs';
import { basename } from 'path';

import { envConfig } from '../utils/envConfig';
import { getFilterSmells } from '../utils/smellsData';

/**
 * Represents a metric item in the tree view.
 */
class MetricItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly carbonSaved?: number,
    public readonly resourceUri?: vscode.Uri, // For file/folder paths
    public readonly smellName?: string, // For smell names
  ) {
    super(label, collapsibleState);

    // Set icon based on contextValue
    switch (this.contextValue) {
      case 'folder':
        this.iconPath = new vscode.ThemeIcon('folder'); // Built-in folder icon
        break;
      case 'file':
        this.iconPath = new vscode.ThemeIcon('file'); // Built-in file icon
        break;
      case 'smell':
        this.iconPath = new vscode.ThemeIcon('tag'); // Built-in warning icon
        break;
      case 'folder-stats':
        this.iconPath = new vscode.ThemeIcon('graph'); // Optional stats icon
        break;
    }

    // Set description for carbon saved
    this.description =
      carbonSaved !== undefined
        ? `Carbon Saved: ${formatNumber(carbonSaved)} kg`
        : '';
    this.tooltip = this.description;

    this.tooltip = smellName !== undefined ? smellName : '';

    if (resourceUri && contextValue === 'file') {
      this.resourceUri = resourceUri;
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

export class MetricsViewProvider implements vscode.TreeDataProvider<MetricItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<MetricItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: MetricItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: MetricItem): Promise<MetricItem[]> {
    const metricsData = this.context.workspaceState.get<{
      [path: string]: MetricsDataItem;
    }>(envConfig.WORKSPACE_METRICS_DATA!, {});

    if (!element) {
      // Root level: Show configured folder/file
      const configuredPath = this.context.workspaceState.get<string>(
        'workspaceConfiguredPath',
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
      // Show folder stats and contents
      const folderPath = element.resourceUri!.fsPath;
      const folderContents = await this.getFolderContents(folderPath);
      const folderMetrics = await this.calculateFolderMetrics(
        folderContents,
        metricsData,
      );

      // Folder stats
      const folderStats = [
        new MetricItem(
          `Total Carbon Saved: ${formatNumber(folderMetrics.totalCarbonSaved)} kg`,
          vscode.TreeItemCollapsibleState.None,
          'folder-stats',
        ),
        ...folderMetrics.smellData.map((data) => this.createSmellItem(data)),
      ];

      // Folder contents (subfolders and files)
      const contents = await Promise.all(
        folderContents.map((item) => {
          if (item.type === 'folder') {
            return this.createFolderItem(item.path);
          } else {
            return this.createFileItem(item.path, metricsData);
          }
        }),
      );

      const children = [...folderStats, ...contents];
      return children.sort(compareTreeItems);
    }

    if (element.contextValue === 'file') {
      // Show smells in the file
      const filePath = element.resourceUri!.fsPath;
      const fileMetrics = this.calculateFileMetrics(filePath, metricsData);
      return fileMetrics.smellData.map((data) => this.createSmellItem(data));
    }

    return [];
  }

  private createFolderItem(folderPath: string): MetricItem {
    return new MetricItem(
      basename(folderPath),
      vscode.TreeItemCollapsibleState.Collapsed,
      'folder',
      undefined,
      vscode.Uri.file(folderPath), // resourceUri
    );
  }

  private createFileItem(
    filePath: string,
    metricsData: { [path: string]: MetricsDataItem },
  ): MetricItem {
    const fileMetrics = this.calculateFileMetrics(filePath, metricsData);
    return new MetricItem(
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
  }): MetricItem {
    return new MetricItem(
      `${data.acronym}: ${formatNumber(data.carbonSaved)} kg`,
      vscode.TreeItemCollapsibleState.None,
      'smell',
      undefined,
      undefined,
      data.name,
    );
  }

  /**
   * Retrieves the contents of a folder (subfolders and files).
   * @param folderPath - The path of the folder.
   */
  private async getFolderContents(
    folderPath: string,
  ): Promise<Array<{ type: 'folder' | 'file'; name: string; path: string }>> {
    try {
      const folderUri = vscode.Uri.file(folderPath);
      const directoryEntries = await vscode.workspace.fs.readDirectory(folderUri);

      const contents: Array<{
        type: 'folder' | 'file';
        name: string;
        path: string;
      }> = [];
      for (const [name, type] of directoryEntries) {
        const fullPath = vscode.Uri.joinPath(folderUri, name).fsPath;
        if (type === vscode.FileType.Directory) {
          contents.push({ type: 'folder', name, path: fullPath });
        } else if (type === vscode.FileType.File && name.endsWith('.py')) {
          contents.push({ type: 'file', name, path: fullPath });
        }
      }

      return contents;
    } catch (error) {
      console.error(`Failed to read directory ${folderPath}:`, error);
      return [];
    }
  }

  /**
   * Calculates the carbon saved for a specific folder dynamically.
   * @param folderContents - The contents of the folder.
   * @param metricsData - The metrics data from the workspace state.
   */
  private async calculateFolderMetrics(
    folderContents: Array<{ type: 'folder' | 'file'; name: string; path: string }>,
    metricsData: { [path: string]: MetricsDataItem },
  ): Promise<{
    totalCarbonSaved: number;
    smellData: { acronym: string; name: string; carbonSaved: number }[];
  }> {
    let totalCarbonSaved = 0;
    const smellDistribution = new Map<string, [string, number]>();

    for (const item of folderContents) {
      if (item.type === 'file') {
        const fileMetrics = this.calculateFileMetrics(item.path, metricsData);
        totalCarbonSaved += fileMetrics.totalCarbonSaved;

        for (const smellData of fileMetrics.smellData) {
          const currentCarbonSaved =
            smellDistribution.get(smellData.acronym)?.[1] || 0;
          smellDistribution.set(smellData.acronym, [
            smellData.name,
            currentCarbonSaved + smellData.carbonSaved,
          ]);
        }
      }
    }

    return {
      totalCarbonSaved,
      smellData: Array.from(smellDistribution.entries()).map(
        ([acronym, [name, carbonSaved]]) => ({
          acronym,
          name,
          carbonSaved,
        }),
      ),
    };
  }

  /**
   * Calculates the carbon saved for a specific file.
   * @param filePath - The path of the file.
   * @param metricsData - The metrics data from the workspace state.
   */
  private calculateFileMetrics(
    filePath: string,
    metricsData: { [path: string]: MetricsDataItem },
  ): {
    totalCarbonSaved: number;
    smellData: { acronym: string; name: string; carbonSaved: number }[];
  } {
    const smellConfigData = getFilterSmells();
    const fileData = metricsData[filePath] || {
      totalCarbonSaved: 0,
      smellDistribution: {},
    };

    // Initialize smell distribution with only enabled smells, defaulting to 0
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
   * Updates the metrics view when a smell is refactored.
   * @param filePath - The path of the refactored file.
   * @param carbonSaved - The amount of carbon saved in kg.
   */
  updateMetrics(filePath: string, carbonSaved: number, smellSymbol: string): void {
    const metrics = this.context.workspaceState.get<{
      [path: string]: MetricsDataItem;
    }>(envConfig.WORKSPACE_METRICS_DATA!, {});

    if (!metrics[filePath]) {
      metrics[filePath] = {
        totalCarbonSaved: 0,
        smellDistribution: {},
      };
    }

    metrics[filePath].totalCarbonSaved =
      (metrics[filePath].totalCarbonSaved || 0) + carbonSaved;

    if (!metrics[filePath].smellDistribution[smellSymbol]) {
      metrics[filePath].smellDistribution[smellSymbol] = 0;
    }
    metrics[filePath].smellDistribution[smellSymbol] += carbonSaved;

    this.context.workspaceState.update(envConfig.WORKSPACE_METRICS_DATA!, metrics);

    this.refresh();
  }
}

const contextPriority: { [key: string]: number } = {
  folder: 1,
  file: 2,
  smell: 3,
  'folder-stats': 4,
};

function compareTreeItems(a: MetricItem, b: MetricItem): number {
  // Sort by contextValue priority first
  const priorityA = contextPriority[a.contextValue] || 0;
  const priorityB = contextPriority[b.contextValue] || 0;
  if (priorityA < priorityB) return -1;
  if (priorityA > priorityB) return 1;

  // If contextValue is the same, sort by label
  if (a.label < b.label) return -1;
  if (a.label > b.label) return 1;

  return 0;
}

function formatNumber(number: number, decimalPlaces: number = 2): string {
  const threshold = 0.001;
  if (Math.abs(number) < threshold) {
    return number.toExponential(decimalPlaces);
  } else {
    return number.toFixed(decimalPlaces);
  }
}
