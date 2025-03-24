import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import { SmellsCacheManager } from '../context/SmellsCacheManager';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { ecoOutput } from '../extension';

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

  if (!configuredPath) {
    ecoOutput.appendLine(
      '[CacheInit] No configured workspace path found - skipping cache initialization',
    );
    return;
  }

  ecoOutput.appendLine(
    `[CacheInit] Starting cache initialization for workspace: ${configuredPath}`,
  );

  const pathMap = smellsCacheManager.getAllFilePaths();
  ecoOutput.appendLine(`[CacheInit] Found ${pathMap.length} files in cache`);
  ecoOutput.appendLine(`[CacheInit] Found ${pathMap} files in cache`);
  let validFiles = 0;
  let removedFiles = 0;
  let filesWithSmells = 0;
  let cleanFiles = 0;

  for (const filePath of pathMap) {
    ecoOutput.appendLine(`[CacheInit] Processing cache entry: ${filePath}`);

    // Ignore files outside the configured workspace
    if (!filePath.startsWith(configuredPath)) {
      ecoOutput.appendLine(
        `[CacheInit] File outside workspace - removing from cache: ${filePath}`,
      );
      await smellsCacheManager.clearCachedSmellsForFile(filePath);
      removedFiles++;
      continue;
    }

    // Verify file still exists
    try {
      await fs.access(filePath);
      ecoOutput.appendLine(`[CacheInit] File verified: ${filePath}`);
    } catch {
      ecoOutput.appendLine(
        `[CacheInit] File not found - removing from cache: ${filePath}`,
      );
      await smellsCacheManager.clearCachedSmellsForFile(filePath);
      removedFiles++;
      continue;
    }

    const smells = smellsCacheManager.getCachedSmells(filePath);
    if (smells !== undefined) {
      validFiles++;

      if (smells.length > 0) {
        ecoOutput.appendLine(
          `[CacheInit] Found ${smells.length} smells for file: ${filePath}`,
        );
        smellsViewProvider.setStatus(filePath, 'passed');
        smellsViewProvider.setSmells(filePath, smells);
        filesWithSmells++;
      } else {
        ecoOutput.appendLine(`[CacheInit] File has no smells: ${filePath}`);
        smellsViewProvider.setStatus(filePath, 'no_issues');
        cleanFiles++;
      }
    } else {
      ecoOutput.appendLine(
        `[CacheInit] No cache data found for file (should not happen): ${filePath}`,
      );
    }
  }

  // Summary statistics
  ecoOutput.appendLine(
    `[CacheInit] Cache initialization complete. ` +
      `Results: ${validFiles} valid files (${filesWithSmells} with smells, ${cleanFiles} clean), ` +
      `${removedFiles} files removed from cache`,
  );
}
