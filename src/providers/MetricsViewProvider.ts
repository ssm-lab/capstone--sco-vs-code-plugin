import * as vscode from 'vscode';
import { envConfig } from '../utils/envConfig';
import { normalizePath } from '../utils/normalizePath';

/**
 * Interface for metrics data stored per file
 */
export interface MetricsDataItem {
  totalCarbonSaved: number;
  smellDistribution: Record<string, number>;
}

/**
 * Service for managing carbon savings metrics data
 * Handles storage and retrieval of refactoring metrics without UI components
 */
export class MetricsViewProvider {
  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Updates metrics data for a specific file
   * @param filePath Path to the file being updated
   * @param smellType Type of smell that was refactored
   * @param carbonSaved Amount of carbon saved by this refactoring
   */
  updateMetrics(filePath: string, smellType: string, carbonSaved: number): void {
    const normalizedPath = normalizePath(filePath);
    const metrics = this.context.workspaceState.get<{
      [path: string]: MetricsDataItem;
    }>(envConfig.WORKSPACE_METRICS_DATA!, {});

    // Initialize file metrics if not exists
    if (!metrics[normalizedPath]) {
      metrics[normalizedPath] = {
        totalCarbonSaved: 0,
        smellDistribution: {},
      };
    }

    // Update metrics
    metrics[normalizedPath].totalCarbonSaved += carbonSaved;
    metrics[normalizedPath].smellDistribution[smellType] = 
      (metrics[normalizedPath].smellDistribution[smellType] || 0) + carbonSaved;

    // Persist changes
    this.context.workspaceState.update(envConfig.WORKSPACE_METRICS_DATA!, metrics);
  }

  /**
   * Retrieves all metrics data
   */
  getMetricsData(): { [path: string]: MetricsDataItem } {
    return this.context.workspaceState.get<{
      [path: string]: MetricsDataItem;
    }>(envConfig.WORKSPACE_METRICS_DATA!, {});
  }

  /**
   * Clears all metrics data
   */
  clearMetricsData(): void {
    this.context.workspaceState.update(envConfig.WORKSPACE_METRICS_DATA!, undefined);
  }

  /**
   * Legacy method for compatibility - no longer refreshes UI since there's no UI
   */
  refresh(): void {
    // No-op: This method is kept for compatibility but does nothing
    // since this is now a data-only service
  }
}
