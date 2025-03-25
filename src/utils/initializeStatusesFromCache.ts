import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import { SmellsCacheManager } from '../context/SmellsCacheManager';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { ecoOutput } from '../extension';
import { normalizePath } from './normalizePath';
import { envConfig } from './envConfig';

/**
 * Initializes file statuses and smells in the SmellsViewProvider from the smell cache.
 * Also validates that cached files are part of the current workspace.
 */
export async function initializeStatusesFromCache(
  context: vscode.ExtensionContext,
  smellsCacheManager: SmellsCacheManager,
  smellsViewProvider: SmellsViewProvider,
): Promise<void> {
  ecoOutput.info('workspace key: ', envConfig.WORKSPACE_CONFIGURED_PATH);
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

  const pathMap = smellsCacheManager.getAllFilePaths();
  ecoOutput.trace(`[CacheInit] Found ${pathMap.length} files in cache`);
  ecoOutput.trace(`[CacheInit] Found ${pathMap} files in cache`);
  let validFiles = 0;
  let removedFiles = 0;
  let filesWithSmells = 0;
  let cleanFiles = 0;

  for (const filePath of pathMap) {
    ecoOutput.trace(`[CacheInit] Processing cache entry: ${filePath}`);

    // Ignore files outside the configured workspace
    if (!filePath.startsWith(configuredPath)) {
      ecoOutput.trace(
        `[CacheInit] File outside workspace - removing from cache: ${filePath}`,
      );
      await smellsCacheManager.clearCachedSmellsForFile(filePath);
      removedFiles++;
      continue;
    }

    // Verify file still exists
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

    const smells = smellsCacheManager.getCachedSmells(filePath);
    if (smells !== undefined) {
      validFiles++;

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

  // Summary statistics
  ecoOutput.info(
    `[CacheInit] Cache initialization complete. ` +
      `Results: ${validFiles} valid files (${filesWithSmells} with smells, ${cleanFiles} clean), ` +
      `${removedFiles} files removed from cache`,
  );
}
