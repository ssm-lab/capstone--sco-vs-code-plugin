import * as vscode from 'vscode';
import { SmellsCacheManager } from '../context/SmellsCacheManager';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';

/**
 * Initializes file statuses in the SmellsViewProvider from the smell cache.
 * Also validates that cached files are part of the current workspace.
 */
export async function initializeStatusesFromCache(
  context: vscode.ExtensionContext,
  smellsCacheManager: SmellsCacheManager,
  smellsViewProvider: SmellsViewProvider,
): Promise<void> {
  const configuredPath = context.workspaceState.get<string>(
    'workspaceConfiguredPath',
  );
  if (!configuredPath) return;

  const cache = smellsCacheManager.getFullSmellCache();
  for (const filePath of Object.keys(cache)) {
    if (!filePath.startsWith(configuredPath)) {
      // Remove cache entry outside of configured workspace
      await smellsCacheManager.clearCachedSmellsForFile(filePath);
    } else {
      const smells = cache[filePath];
      const status = smells.length > 0 ? 'passed' : 'no_issues';
      smellsViewProvider.setStatus(filePath, status);
    }
  }
}
