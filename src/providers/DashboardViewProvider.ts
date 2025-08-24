import * as vscode from 'vscode';
import { envConfig } from '../utils/envConfig';
import { getFilterSmells } from '../utils/smellsData';
import { SmellsCacheManager } from '../context/SmellsCacheManager';
import { MetricsDataItem } from './MetricsViewProvider';

/**
 * Static mapping of carbon savings per smell type (in kg CO2).
 * TODO: This is a placeholder and should be replaced with actual values once empirical data is available.
 */
const CARBON_SAVINGS_MAPPING: Record<string, number> = {
  // Pylint smells
  'use-a-generator': 0.0025,
  'too-many-arguments': 0.0015,
  'no-self-use': 0.001,

  // Custom smells
  'long-lambda-expression': 0.002,
  'long-message-chain': 0.003,
  'long-element-chain': 0.0025,
  'cached-repeated-calls': 0.005,
  'string-concat-loop': 0.004,
};

/**
 * Custom TreeItem for displaying dashboard metrics
 */
class DashboardTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly value?: number,
    public readonly description?: string,
    public readonly iconName?: string,
    public readonly iconColor?: vscode.ThemeColor,
  ) {
    super(label, collapsibleState);

    // Set icon for each item
    if (iconName) {
      this.iconPath = new vscode.ThemeIcon(iconName, iconColor);
    } else {
      switch (this.contextValue) {
        case 'overview':
          this.iconPath = new vscode.ThemeIcon(
            'dashboard',
            new vscode.ThemeColor('charts.blue'),
          );
          break;
        case 'achievements':
          this.iconPath = new vscode.ThemeIcon(
            'history',
            new vscode.ThemeColor('charts.green'),
          );
          break;
        case 'opportunities':
          this.iconPath = new vscode.ThemeIcon(
            'target',
            new vscode.ThemeColor('charts.orange'),
          );
          break;
        case 'energy-guide':
          this.iconPath = new vscode.ThemeIcon(
            'book',
            new vscode.ThemeColor('charts.purple'),
          );
          break;
        case 'high-impact-header':
        case 'medium-impact-header':
        case 'low-impact-header':
          // no icon for impact headers
          this.iconPath = undefined;
          break;
        case 'stat-item':
        case 'achievement-item':
        case 'smell-item':
        case 'guide-item':
        case 'target-item':
          this.iconPath = undefined;
          break;
        default:
          this.iconPath = undefined;
      }
    }

    this.description = description;
    this.tooltip = this.createTooltip();
  }

  private createTooltip(): string {
    // Special tooltips for overview items
    if (this.label.startsWith('Refactorings Applied:')) {
      return `Total accepted individual code refactorings`;
    }
    if (this.label.startsWith('Carbon Emission Savings:')) {
      return `Cumulative carbon savings for all refactorings`;
    }
    if (this.label.startsWith('Code Smells Identified:')) {
      return `Active code smells in workspace`;
    }
    if (this.label.startsWith('Potential Carbon Emission Reduction:')) {
      return `Available carbon savings from unrefactored code smells`;
    }

    return '';
  }
}

/**
 * Dashboard statistics
 */
interface DashboardStats {
  totalRefactorings: number;
  totalEnergySaved: number;
  detectedSmells: number;
  potentialSavings: number;
  topAchievements: Array<{
    symbol: string;
    name: string;
    acronym: string;
    energySaved: number;
    refactorings: number;
  }>;
  topOpportunities: Array<{
    symbol: string;
    name: string;
    acronym: string;
    detectedCount: number;
    potentialSavings: number;
  }>;
}

/**
 * Provides a dashboard view of refactoring statistics and carbon savings
 */
export class DashboardViewProvider
  implements vscode.TreeDataProvider<DashboardTreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    DashboardTreeItem | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private context: vscode.ExtensionContext,
    private smellsCacheManager: SmellsCacheManager,
  ) {
    // Listen for cache updates to refresh dashboard
    this.smellsCacheManager.onSmellsUpdated(() => {
      this.refresh();
    });
  }

  /**
   * Triggers a refresh of the dashboard
   */
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: DashboardTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Builds the dashboard tree hierarchy
   */
  async getChildren(element?: DashboardTreeItem): Promise<DashboardTreeItem[]> {
    if (!element) {
      // Root level - show main dashboard sections
      return this.createRootItems();
    }

    // Handle expandable sections
    switch (element.contextValue) {
      case 'overview':
        return this.createOverviewItems();
      case 'achievements':
        return this.createAchievementsItems();
      case 'opportunities':
        return this.createOpportunitiesItems();
      case 'energy-guide':
        return this.createEnergyGuideItems();
      case 'high-impact-guide':
      case 'high-impact-header':
        return this.createHighImpactGuideItems();
      case 'medium-impact-guide':
      case 'medium-impact-header':
        return this.createMediumImpactGuideItems();
      case 'low-impact-guide':
      case 'low-impact-header':
        return this.createLowImpactGuideItems();
      case 'high-impact-targets-header':
        return this.createHighImpactTargetsItems();
      case 'medium-impact-targets-header':
        return this.createMediumImpactTargetsItems();
      case 'low-impact-targets-header':
        return this.createLowImpactTargetsItems();
      default:
        return [];
    }
  }

  /**
   * Creates the main dashboard sections
   */
  private createRootItems(): DashboardTreeItem[] {
    // Check if workspace is configured
    const workspaceConfigured = this.context.workspaceState.get<string>(
      envConfig.WORKSPACE_CONFIGURED_PATH!,
    );

    if (!workspaceConfigured) {
      // only show energy impact reference and configuration prompt when no workspace is configured
      const configureItem = new DashboardTreeItem(
        'Configure Workspace',
        vscode.TreeItemCollapsibleState.None,
        'configure-workspace',
        undefined,
        'Set up your workspace to start tracking refactoring statistics and energy savings',
        'settings-gear',
        new vscode.ThemeColor('charts.blue'),
      );

      configureItem.command = {
        title: 'Configure Workspace',
        command: 'ecooptimizer.configureWorkspace',
        arguments: [],
      };

      return [
        configureItem,
        new DashboardTreeItem(
          'ENERGY IMPACT REFERENCE',
          vscode.TreeItemCollapsibleState.Expanded,
          'energy-guide',
          undefined,
          undefined,
        ),
      ];
    }

    // show complete dashboard when workspace is configured
    return [
      new DashboardTreeItem(
        'OVERVIEW',
        vscode.TreeItemCollapsibleState.Expanded,
        'overview',
        undefined,
        undefined,
      ),
      new DashboardTreeItem(
        'REFACTORING HISTORY',
        vscode.TreeItemCollapsibleState.Collapsed,
        'achievements',
        undefined,
        undefined,
        'history',
        new vscode.ThemeColor('charts.green'),
      ),
      new DashboardTreeItem(
        'OPTIMIZATION TARGETS',
        vscode.TreeItemCollapsibleState.Collapsed,
        'opportunities',
        undefined,
        undefined,
      ),
      new DashboardTreeItem(
        'ENERGY IMPACT REFERENCE',
        vscode.TreeItemCollapsibleState.Collapsed,
        'energy-guide',
        undefined,
        undefined,
      ),
    ];
  }

  /**
   * Create overview summary items
   */
  private createOverviewItems(): DashboardTreeItem[] {
    const stats = this.calculateDashboardStats();
    const items: DashboardTreeItem[] = [];

    items.push(
      new DashboardTreeItem(
        `Refactorings Applied: ${stats.totalRefactorings}`,
        vscode.TreeItemCollapsibleState.None,
        'stat-item',
        stats.totalRefactorings,
        undefined,
        'check-all',
        new vscode.ThemeColor('charts.green'),
      ),
    );

    items.push(
      new DashboardTreeItem(
        `Carbon Emission Savings: ${this.formatNumber(stats.totalEnergySaved)} kg CO₂`,
        vscode.TreeItemCollapsibleState.None,
        'stat-item',
        stats.totalEnergySaved,
        undefined,
        'lightbulb',
        new vscode.ThemeColor('charts.yellow'),
      ),
    );

    items.push(
      new DashboardTreeItem(
        `Code Smells Identified: ${stats.detectedSmells}`,
        vscode.TreeItemCollapsibleState.None,
        'stat-item',
        stats.detectedSmells,
        undefined,
        'search',
        new vscode.ThemeColor('charts.orange'),
      ),
    );

    items.push(
      new DashboardTreeItem(
        `Potential Carbon Emission Reduction: ${this.formatNumber(stats.potentialSavings)} kg CO₂`,
        vscode.TreeItemCollapsibleState.None,
        'stat-item',
        stats.potentialSavings,
        undefined,
        'target',
        new vscode.ThemeColor('charts.red'),
      ),
    );

    return items;
  }

  /**
   * Create achievements section items
   */
  private createAchievementsItems(): DashboardTreeItem[] {
    const stats = this.calculateDashboardStats();
    const items: DashboardTreeItem[] = [];

    if (stats.totalRefactorings === 0) {
      items.push(
        new DashboardTreeItem(
          'No optimizations applied yet',
          vscode.TreeItemCollapsibleState.None,
          'stat-item',
          undefined,
          'Begin refactoring to track optimization history',
          undefined,
          undefined,
        ),
      );
      return items;
    }

    const avgEnergy = stats.totalEnergySaved / stats.totalRefactorings;
    items.push(
      new DashboardTreeItem(
        `Total Optimizations: ${stats.totalRefactorings}`,
        vscode.TreeItemCollapsibleState.None,
        'stat-item',
        stats.totalRefactorings,
        undefined,
        undefined,
        undefined,
      ),
    );

    items.push(
      new DashboardTreeItem(
        `Average Impact per Refactoring: ${this.formatNumber(avgEnergy)} kg CO₂`,
        vscode.TreeItemCollapsibleState.None,
        'stat-item',
        avgEnergy,
        undefined,
        undefined,
        undefined,
      ),
    );

    if (stats.topAchievements.length > 0) {
      stats.topAchievements.slice(0, 3).forEach((achievement) => {
        items.push(
          new DashboardTreeItem(
            `${achievement.name}: ${achievement.refactorings} fixes, ${this.formatNumber(achievement.energySaved)} kg CO₂`,
            vscode.TreeItemCollapsibleState.None,
            'achievement-item',
            achievement.energySaved,
            undefined,
            undefined,
            undefined,
          ),
        );
      });
    }

    return items;
  }

  /**
   * Create opportunities section items
   */
  private createOpportunitiesItems(): DashboardTreeItem[] {
    const stats = this.calculateDashboardStats();
    const items: DashboardTreeItem[] = [];

    if (stats.detectedSmells === 0) {
      items.push(
        new DashboardTreeItem(
          '    No code issues detected',
          vscode.TreeItemCollapsibleState.None,
          'stat-item',
          undefined,
          'Run analysis to identify optimization opportunities',
          'info',
        ),
      );
      return items;
    }

    // Group by impact level
    const highImpactOpportunities = stats.topOpportunities.filter((opp) => {
      const energyPerSmell = CARBON_SAVINGS_MAPPING[opp.symbol] || 0;
      return energyPerSmell >= 0.004;
    });

    const mediumImpactOpportunities = stats.topOpportunities.filter((opp) => {
      const energyPerSmell = CARBON_SAVINGS_MAPPING[opp.symbol] || 0;
      return energyPerSmell >= 0.002 && energyPerSmell < 0.004;
    });

    const lowImpactOpportunities = stats.topOpportunities.filter((opp) => {
      const energyPerSmell = CARBON_SAVINGS_MAPPING[opp.symbol] || 0;
      return energyPerSmell < 0.002;
    });

    // High impact targets
    if (highImpactOpportunities.length > 0) {
      const item = new DashboardTreeItem(
        `HIGH IMPACT (≥0.004 kg CO₂)`,
        vscode.TreeItemCollapsibleState.Collapsed,
        'high-impact-targets-header',
        undefined,
        undefined,
        'lightbulb',
        new vscode.ThemeColor('charts.red'),
      );
      items.push(item);
    }

    // Medium impact targets
    if (mediumImpactOpportunities.length > 0) {
      const item = new DashboardTreeItem(
        `MEDIUM IMPACT (0.002-0.004 kg CO₂)`,
        vscode.TreeItemCollapsibleState.Collapsed,
        'medium-impact-targets-header',
        undefined,
        undefined,
        'lightbulb',
        new vscode.ThemeColor('charts.orange'),
      );
      items.push(item);
    }

    // Low impact targets
    if (lowImpactOpportunities.length > 0) {
      const item = new DashboardTreeItem(
        `LOW IMPACT (<0.002 kg CO₂)`,
        vscode.TreeItemCollapsibleState.Collapsed,
        'low-impact-targets-header',
        undefined,
        undefined,
        'lightbulb',
        new vscode.ThemeColor('charts.blue'),
      );
      items.push(item);
    }

    return items;
  }

  /**
   * Create high-impact targets items
   */
  private createHighImpactTargetsItems(): DashboardTreeItem[] {
    const stats = this.calculateDashboardStats();
    const items: DashboardTreeItem[] = [];

    const highImpactOpportunities = stats.topOpportunities.filter((opp) => {
      const energyPerSmell = CARBON_SAVINGS_MAPPING[opp.symbol] || 0;
      return energyPerSmell >= 0.004;
    });

    highImpactOpportunities.forEach((opportunity) => {
      items.push(
        new DashboardTreeItem(
          `${opportunity.name}: ${this.formatNumber(opportunity.potentialSavings)} kg CO₂ total`,
          vscode.TreeItemCollapsibleState.None,
          'target-item',
          opportunity.potentialSavings,
          `${opportunity.detectedCount} instances`,
          undefined,
          undefined,
        ),
      );
    });

    return items;
  }

  /**
   * Create medium-impact targets items
   */
  private createMediumImpactTargetsItems(): DashboardTreeItem[] {
    const stats = this.calculateDashboardStats();
    const items: DashboardTreeItem[] = [];

    const mediumImpactOpportunities = stats.topOpportunities.filter((opp) => {
      const energyPerSmell = CARBON_SAVINGS_MAPPING[opp.symbol] || 0;
      return energyPerSmell >= 0.002 && energyPerSmell < 0.004;
    });

    mediumImpactOpportunities.forEach((opportunity) => {
      items.push(
        new DashboardTreeItem(
          `${opportunity.name}: ${this.formatNumber(opportunity.potentialSavings)} kg CO₂ total`,
          vscode.TreeItemCollapsibleState.None,
          'target-item',
          opportunity.potentialSavings,
          `${opportunity.detectedCount} instances`,
          undefined,
          undefined,
        ),
      );
    });

    return items;
  }

  /**
   * Create low-impact targets items
   */
  private createLowImpactTargetsItems(): DashboardTreeItem[] {
    const stats = this.calculateDashboardStats();
    const items: DashboardTreeItem[] = [];

    const lowImpactOpportunities = stats.topOpportunities.filter((opp) => {
      const energyPerSmell = CARBON_SAVINGS_MAPPING[opp.symbol] || 0;
      return energyPerSmell < 0.002;
    });

    lowImpactOpportunities.forEach((opportunity) => {
      items.push(
        new DashboardTreeItem(
          `${opportunity.name}: ${this.formatNumber(opportunity.potentialSavings)} kg CO₂ total`,
          vscode.TreeItemCollapsibleState.None,
          'target-item',
          opportunity.potentialSavings,
          `${opportunity.detectedCount} instances`,
          undefined,
          undefined,
        ),
      );
    });

    return items;
  }

  /**
   * Create energy guide section items
   */
  private createEnergyGuideItems(): DashboardTreeItem[] {
    const smellConfigData = getFilterSmells();
    const items: DashboardTreeItem[] = [];

    // Sort smell types by energy savings from highest to lowest
    const sortedSmells = Object.entries(CARBON_SAVINGS_MAPPING)
      .filter(([symbol]) => smellConfigData[symbol]) // Only show enabled smells
      .sort(([, a], [, b]) => b - a);

    // Group by impact level
    const highImpact = sortedSmells.filter(([, energy]) => energy >= 0.004);
    const mediumImpact = sortedSmells.filter(
      ([, energy]) => energy >= 0.002 && energy < 0.004,
    );
    const lowImpact = sortedSmells.filter(([, energy]) => energy < 0.002);

    // High impact section
    if (highImpact.length > 0) {
      const item = new DashboardTreeItem(
        `HIGH IMPACT (≥0.004 kg CO₂)`,
        vscode.TreeItemCollapsibleState.Collapsed,
        'high-impact-header',
        undefined,
        undefined,
        'lightbulb',
        new vscode.ThemeColor('charts.red'),
      );
      items.push(item);
    }

    // Medium impact section
    if (mediumImpact.length > 0) {
      const item = new DashboardTreeItem(
        `MEDIUM IMPACT (0.002-0.004 kg CO₂)`,
        vscode.TreeItemCollapsibleState.Collapsed,
        'medium-impact-header',
        undefined,
        undefined,
        'lightbulb',
        new vscode.ThemeColor('charts.orange'),
      );
      items.push(item);
    }

    // Low impact section
    if (lowImpact.length > 0) {
      const item = new DashboardTreeItem(
        `LOW IMPACT (<0.002 kg CO₂)`,
        vscode.TreeItemCollapsibleState.Collapsed,
        'low-impact-header',
        undefined,
        undefined,
        'lightbulb',
        new vscode.ThemeColor('charts.blue'),
      );
      items.push(item);
    }

    return items;
  }

  /**
   * Creates high impact guide items
   */
  private createHighImpactGuideItems(): DashboardTreeItem[] {
    const smellConfigData = getFilterSmells();
    const items: DashboardTreeItem[] = [];

    const sortedSmells = Object.entries(CARBON_SAVINGS_MAPPING)
      .filter(([symbol]) => smellConfigData[symbol])
      .sort(([, a], [, b]) => b - a);

    const highImpact = sortedSmells.filter(([, energy]) => energy >= 0.004);

    highImpact.forEach(([symbol, energySaving]) => {
      const config = smellConfigData[symbol];
      if (config) {
        items.push(
          new DashboardTreeItem(
            `${config.name}: ${this.formatNumber(energySaving)} kg CO₂ per refactoring`,
            vscode.TreeItemCollapsibleState.None,
            'guide-item',
            energySaving,
            undefined,
            undefined,
            undefined,
          ),
        );
      }
    });

    return items;
  }

  /**
   * Creates medium impact guide items
   */
  private createMediumImpactGuideItems(): DashboardTreeItem[] {
    const smellConfigData = getFilterSmells();
    const items: DashboardTreeItem[] = [];

    const sortedSmells = Object.entries(CARBON_SAVINGS_MAPPING)
      .filter(([symbol]) => smellConfigData[symbol])
      .sort(([, a], [, b]) => b - a);

    const mediumImpact = sortedSmells.filter(
      ([, energy]) => energy >= 0.002 && energy < 0.004,
    );

    mediumImpact.forEach(([symbol, energySaving]) => {
      const config = smellConfigData[symbol];
      if (config) {
        items.push(
          new DashboardTreeItem(
            `${config.name}: ${this.formatNumber(energySaving)} kg CO₂ per refactoring`,
            vscode.TreeItemCollapsibleState.None,
            'guide-item',
            energySaving,
            undefined,
            undefined,
            undefined,
          ),
        );
      }
    });

    return items;
  }

  /**
   * Creates low impact guide items
   */
  private createLowImpactGuideItems(): DashboardTreeItem[] {
    const smellConfigData = getFilterSmells();
    const items: DashboardTreeItem[] = [];

    const sortedSmells = Object.entries(CARBON_SAVINGS_MAPPING)
      .filter(([symbol]) => smellConfigData[symbol])
      .sort(([, a], [, b]) => b - a);

    const lowImpact = sortedSmells.filter(([, energy]) => energy < 0.002);

    lowImpact.forEach(([symbol, energySaving]) => {
      const config = smellConfigData[symbol];
      if (config) {
        items.push(
          new DashboardTreeItem(
            `${config.name}: ${this.formatNumber(energySaving)} kg CO₂ per refactoring`,
            vscode.TreeItemCollapsibleState.None,
            'guide-item',
            energySaving,
            undefined,
            undefined,
            undefined,
          ),
        );
      }
    });

    return items;
  }

  /**
   * Calculates comprehensive dashboard statistics
   */
  private calculateDashboardStats(): DashboardStats {
    const metricsData = this.context.workspaceState.get<{
      [path: string]: MetricsDataItem;
    }>(envConfig.WORKSPACE_METRICS_DATA!, {});

    const smellConfigData = getFilterSmells();
    const smellCache = this.smellsCacheManager.getFullSmellCache();
    const pathMap = this.smellsCacheManager.getHashToPathMap();

    // Calculate achievements from metrics data
    const achievementMap = new Map<
      string,
      {
        name: string;
        acronym: string;
        refactorings: number;
        energySaved: number;
      }
    >();

    let totalRefactorings = 0;
    let totalEnergySaved = 0;

    Object.entries(metricsData).forEach(([filePath, fileData]) => {
      Object.entries(fileData.smellDistribution).forEach(([symbol, energySaved]) => {
        if (energySaved > 0 && smellConfigData[symbol]) {
          const refactorCount = Math.round(
            energySaved / (CARBON_SAVINGS_MAPPING[symbol] || 0.001),
          );

          if (!achievementMap.has(symbol)) {
            achievementMap.set(symbol, {
              name: smellConfigData[symbol].name,
              acronym: smellConfigData[symbol].acronym,
              refactorings: 0,
              energySaved: 0,
            });
          }

          const achievement = achievementMap.get(symbol)!;
          achievement.refactorings += refactorCount;
          achievement.energySaved += energySaved;
          totalRefactorings += refactorCount;
        }
      });
      totalEnergySaved += fileData.totalCarbonSaved;
    });

    // Calculate opportunities from detected smells
    const opportunityMap = new Map<
      string,
      {
        name: string;
        acronym: string;
        detectedCount: number;
        potentialSavings: number;
      }
    >();

    let detectedSmells = 0;
    let potentialSavings = 0;

    Object.entries(smellCache).forEach(([hash, smells]) => {
      const filePath = pathMap[hash];
      if (filePath) {
        smells.forEach((smell) => {
          if (smellConfigData[smell.symbol]) {
            const energyPerSmell = CARBON_SAVINGS_MAPPING[smell.symbol] || 0;

            if (!opportunityMap.has(smell.symbol)) {
              opportunityMap.set(smell.symbol, {
                name: smellConfigData[smell.symbol].name,
                acronym: smellConfigData[smell.symbol].acronym,
                detectedCount: 0,
                potentialSavings: 0,
              });
            }

            const opportunity = opportunityMap.get(smell.symbol)!;
            opportunity.detectedCount += 1;
            opportunity.potentialSavings += energyPerSmell;
            detectedSmells += 1;
            potentialSavings += energyPerSmell;
          }
        });
      }
    });

    // Create sorted arrays
    const topAchievements = Array.from(achievementMap.entries())
      .map(([symbol, data]) => ({ symbol, ...data }))
      .sort((a, b) => b.energySaved - a.energySaved);

    const topOpportunities = Array.from(opportunityMap.entries())
      .map(([symbol, data]) => ({ symbol, ...data }))
      .sort((a, b) => b.potentialSavings - a.potentialSavings);

    return {
      totalRefactorings,
      totalEnergySaved,
      detectedSmells,
      potentialSavings,
      topAchievements,
      topOpportunities,
    };
  }

  /**
   * Formats numbers for display
   */
  private formatNumber(number: number, decimalPlaces: number = 4): string {
    if (number === 0) return '0';
    if (number < 0.0001) return '< 0.0001';
    return number.toFixed(decimalPlaces);
  }
}
