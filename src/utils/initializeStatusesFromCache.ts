import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import { SmellsCacheManager } from '../context/SmellsCacheManager';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { ecoOutput } from '../extension';
import { normalizePath } from './normalizePath';
import { envConfig } from './envConfig';

/**
 * Initializes file statuses and smells in the SmellsViewProvider from the smell cache.

 * @param context The extension context containing workspace configuration
 * @param smellsCacheManager The cache manager instance
 * @param smellsViewProvider The view provider to update with cached data
 */
export async function initializeStatusesFromCache(
  context: vscode.ExtensionContext,
  smellsCacheManager: SmellsCacheManager,
  smellsViewProvider: SmellsViewProvider,
): Promise<void> {
  ecoOutput.info('workspace key: ', envConfig.WORKSPACE_CONFIGURED_PATH);

  // Get configured workspace path from extension state
  let configuredPath = context.workspaceState.get<string>(
    envConfig.WORKSPACE_CONFIGURED_PATH!,
  );

  if (!configuredPath) {
    ecoOutput.warn(
      '[CacheInit] No configured workspace path found - skipping cache initialization',
    );
    return;
  }

  configuredPath = normalizePath(configuredPath);
  ecoOutput.info(
    `[CacheInit] Starting cache initialization for workspace: ${configuredPath}`,
  );

  // Get all cached file paths and initialize counters
  const pathMap = smellsCacheManager.getAllFilePaths();
  ecoOutput.trace(`[CacheInit] Found ${pathMap.length} files in cache`);
  ecoOutput.trace(`[CacheInit] Found ${pathMap} files in cache`);

  let validFiles = 0;
  let removedFiles = 0;
  let filesWithSmells = 0;
  let cleanFiles = 0;

  // Process each cached file
  for (const filePath of pathMap) {
    ecoOutput.trace(`[CacheInit] Processing cache entry: ${filePath}`);

    // Skip files outside the current workspace
    if (!filePath.startsWith(configuredPath)) {
      ecoOutput.trace(
        `[CacheInit] File outside workspace - removing from cache: ${filePath}`,
      );
      await smellsCacheManager.clearCachedSmellsForFile(filePath);
      removedFiles++;
      continue;
    }

    // Verify file exists on disk
    try {
      await fs.access(filePath);
      ecoOutput.trace(`[CacheInit] File verified: ${filePath}`);
    } catch {
      ecoOutput.trace(
        `[CacheInit] File not found - removing from cache: ${filePath}`,
      );
      await smellsCacheManager.clearCachedSmellsForFile(filePath);
      removedFiles++;
      continue;
    }

    // Get cached smells for valid files
    const smells = smellsCacheManager.getCachedSmells(filePath);
    if (smells !== undefined) {
      validFiles++;

      // Update view provider based on smell data
      if (smells.length > 0) {
        ecoOutput.trace(
          `[CacheInit] Found ${smells.length} smells for file: ${filePath}`,
        );
        smellsViewProvider.setStatus(filePath, 'passed');
        smellsViewProvider.setSmells(filePath, smells);
        filesWithSmells++;
      } else {
        ecoOutput.trace(`[CacheInit] File has no smells: ${filePath}`);
        smellsViewProvider.setStatus(filePath, 'no_issues');
        cleanFiles++;
      }
    } else {
      ecoOutput.trace(
        `[CacheInit] No cache data found for file (should not happen): ${filePath}`,
      );
    }
  }

  // Log summary statistics
  ecoOutput.info(
    `[CacheInit] Cache initialization complete. ` +
      `Results: ${validFiles} valid files (${filesWithSmells} with smells, ${cleanFiles} clean), ` +
      `${removedFiles} files removed from cache`,
  );
}
