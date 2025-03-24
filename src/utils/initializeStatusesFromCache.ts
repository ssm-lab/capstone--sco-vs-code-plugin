import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import { SmellsCacheManager } from '../context/SmellsCacheManager';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';

/**
 * Initializes file statuses and smells in the SmellsViewProvider from the smell cache.
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

  const pathMap = smellsCacheManager.getAllFilePaths(); // Returns string[]
  for (const filePath of pathMap) {
    // Ignore files outside the configured workspace or that don't exist anymore
    if (!filePath.startsWith(configuredPath)) {
      await smellsCacheManager.clearCachedSmellsForFile(filePath);
      continue;
    }

    try {
      await fs.access(filePath); // Throws if file doesn't exist
    } catch {
      await smellsCacheManager.clearCachedSmellsForFile(filePath);
      continue;
    }

    const smells = smellsCacheManager.getCachedSmells(filePath);
    if (smells !== undefined) {
      const status = smells.length > 0 ? 'passed' : 'no_issues';
      smellsViewProvider.setStatus(filePath, status);
      smellsViewProvider.setSmells(filePath, smells); // Set smells in the tree view
    }
  }
}
