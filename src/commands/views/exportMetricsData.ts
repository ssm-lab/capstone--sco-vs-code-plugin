import * as vscode from 'vscode';
import { dirname } from 'path';
import { writeFileSync } from 'fs';

import { MetricsDataItem } from '../../providers/MetricsViewProvider';
import { envConfig } from '../../utils/envConfig';

/**
 * Exports collected metrics data to a JSON file in the workspace.
 * Handles both file and directory workspace paths, saving the output
 * as 'metrics-data.json' in the appropriate location.
 *
 * @param context - Extension context containing metrics data and workspace state
 */
export async function exportMetricsData(
  context: vscode.ExtensionContext,
): Promise<void> {
  // Retrieve stored metrics data from extension context
  const metricsData = context.workspaceState.get<{
    [path: string]: MetricsDataItem;
  }>(envConfig.WORKSPACE_METRICS_DATA!, {});

  console.log('metrics data:', metricsData);

  // Early return if no data available
  if (Object.keys(metricsData).length === 0) {
    vscode.window.showInformationMessage('No metrics data available to export.');
    return;
  }

  // Get configured workspace path from extension context
  const configuredWorkspacePath = context.workspaceState.get<string>(
    envConfig.WORKSPACE_CONFIGURED_PATH!,
  );

  console.log('configured path:', configuredWorkspacePath);

  if (!configuredWorkspacePath) {
    vscode.window.showErrorMessage('No configured workspace path found.');
    return;
  }

  // Determine output file location based on workspace type
  const workspaceUri = vscode.Uri.file(configuredWorkspacePath);
  let fileUri: vscode.Uri;

  try {
    const stat = await vscode.workspace.fs.stat(workspaceUri);

    if (stat.type === vscode.FileType.Directory) {
      // For directories, save directly in the workspace root
      fileUri = vscode.Uri.joinPath(workspaceUri, 'metrics-data.json');
    } else if (stat.type === vscode.FileType.File) {
      // For single files, save in the parent directory
      const parentDir = vscode.Uri.file(dirname(configuredWorkspacePath));
      fileUri = vscode.Uri.joinPath(parentDir, 'metrics-data.json');
    } else {
      vscode.window.showErrorMessage('Invalid workspace path type.');
      return;
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to access workspace path: ${error}`);
    return;
  }

  // Write the metrics data to JSON file
  try {
    const jsonData = JSON.stringify(metricsData, null, 2);
    writeFileSync(fileUri.fsPath, jsonData, 'utf-8');
    vscode.window.showInformationMessage(
      `Metrics data exported successfully to ${fileUri.fsPath}`,
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to export metrics data: ${error}`);
  }
}
