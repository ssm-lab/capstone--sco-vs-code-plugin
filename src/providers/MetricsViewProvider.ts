import * as vscode from 'vscode';
import * as fs from 'fs';
import { basename } from 'path';
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

export class MetricsViewProvider implements vscode.TreeDataProvider<MetricTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    MetricTreeItem | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

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
        ...folderMetrics.smellData.map((data) => this.createSmellItem(data)),
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
  ): Promise<{
    totalCarbonSaved: number;
    smellData: { acronym: string; name: string; carbonSaved: number }[];
  }> {
    let totalCarbonSaved = 0;
    const smellDistribution = new Map<string, [string, number]>();

    const treeNodes = buildPythonTree(folderPath);
    const fileNodes = treeNodes.filter((node) => node.isFile);

    for (const node of fileNodes) {
      const fileMetrics = this.calculateFileMetrics(node.fullPath, metricsData);
      totalCarbonSaved += fileMetrics.totalCarbonSaved;

      for (const smellData of fileMetrics.smellData) {
        const current = smellDistribution.get(smellData.acronym)?.[1] || 0;
        smellDistribution.set(smellData.acronym, [
          smellData.name,
          current + smellData.carbonSaved,
        ]);
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
    this.refresh();
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
