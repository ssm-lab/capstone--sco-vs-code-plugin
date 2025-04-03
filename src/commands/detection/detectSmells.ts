import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { fetchSmells } from '../../api/backend';
import { SmellsViewProvider } from '../../providers/SmellsViewProvider';
import { getEnabledSmells } from '../../utils/smellsData';
import { serverStatus, ServerStatusType } from '../../emitters/serverStatus';
import { SmellsCacheManager } from '../../context/SmellsCacheManager';
import { ecoOutput } from '../../extension';

/**
 * Performs code smell analysis on a single Python file with comprehensive state management.
 * Only shows user notifications for critical events requiring attention.
 *
 * @param filePath - Absolute path to the Python file to analyze
 * @param smellsViewProvider - Provider for updating the UI with results
 * @param smellsCacheManager - Manager for cached smell results
 */
export async function detectSmellsFile(
  filePath: string,
  smellsViewProvider: SmellsViewProvider,
  smellsCacheManager: SmellsCacheManager,
): Promise<void> {
  const shouldProceed = await precheckAndMarkQueued(
    filePath,
    smellsViewProvider,
    smellsCacheManager,
  );

  if (!shouldProceed) return;

  // Transform enabled smells into backend-compatible format
  const enabledSmells = getEnabledSmells();
  const enabledSmellsForBackend = Object.fromEntries(
    Object.entries(enabledSmells).map(([key, value]) => [key, value.options]),
  );

  try {
    ecoOutput.info(`[detection.ts] Analyzing: ${path.basename(filePath)}`);
    const { smells, status } = await fetchSmells(filePath, enabledSmellsForBackend);

    // Handle backend response
    if (status === 200) {
      if (smells.length > 0) {
        ecoOutput.info(`[detection.ts] Detected ${smells.length} smells`);
        smellsViewProvider.setStatus(filePath, 'passed');
        await smellsCacheManager.setCachedSmells(filePath, smells);
        smellsViewProvider.setSmells(filePath, smells);
      } else {
        ecoOutput.info('[detection.ts] File has no detectable smells');
        smellsViewProvider.setStatus(filePath, 'no_issues');
        await smellsCacheManager.setCachedSmells(filePath, []);
      }
    } else {
      const msg = `Analysis failed for ${path.basename(filePath)} (status ${status})`;
      ecoOutput.error(`[detection.ts] ${msg}`);
      smellsViewProvider.setStatus(filePath, 'failed');
      vscode.window.showErrorMessage(msg);
    }
  } catch (error: any) {
    const msg = `Analysis failed: ${error.message}`;
    ecoOutput.error(`[detection.ts] ${msg}`);
    smellsViewProvider.setStatus(filePath, 'failed');
    vscode.window.showErrorMessage(msg);
  }
}

/**
 * Validates conditions before analysis. Only shows notifications when:
 * - Using cached results (info)
 * - Server is down (warning)
 * - No smells configured (warning)
 *
 * @returns boolean indicating whether analysis should proceed
 */
async function precheckAndMarkQueued(
  filePath: string,
  smellsViewProvider: SmellsViewProvider,
  smellsCacheManager: SmellsCacheManager,
): Promise<boolean> {
  // Validate file scheme and extension
  const fileUri = vscode.Uri.file(filePath);
  if (fileUri.scheme !== 'file') {
    return false;
  }

  if (!filePath.endsWith('.py')) {
    return false;
  }

  // Check for cached results
  if (smellsCacheManager.hasCachedSmells(filePath)) {
    const cached = smellsCacheManager.getCachedSmells(filePath);
    ecoOutput.info(
      `[detection.ts] Using cached results for ${path.basename(filePath)}`,
    );

    if (cached && cached.length > 0) {
      smellsViewProvider.setStatus(filePath, 'passed');
      smellsViewProvider.setSmells(filePath, cached);
    } else {
      smellsViewProvider.setStatus(filePath, 'no_issues');
    }
    return false;
  }

  // Check server availability
  if (serverStatus.getStatus() === ServerStatusType.DOWN) {
    const msg = 'Backend server unavailable - using cached results where available';
    ecoOutput.warn(`[detection.ts] ${msg}`);
    vscode.window.showWarningMessage(msg);
    smellsViewProvider.setStatus(filePath, 'server_down');
    return false;
  }

  // Verify at least one smell detector is enabled
  const enabledSmells = getEnabledSmells();
  if (Object.keys(enabledSmells).length === 0) {
    const msg = 'No smell detectors enabled in settings';
    ecoOutput.warn(`[detection.ts] ${msg}`);
    vscode.window.showWarningMessage(msg);
    return false;
  }

  smellsViewProvider.setStatus(filePath, 'queued');
  return true;
}

/**
 * Recursively analyzes Python files in a directory with progress indication.
 * Shows a progress notification for the folder scan operation.
 *
 * @param folderPath - Absolute path to the folder to analyze
 * @param smellsViewProvider - Provider for updating the UI with results
 * @param smellsCacheManager - Manager for cached smell results
 */
export async function detectSmellsFolder(
  folderPath: string,
  smellsViewProvider: SmellsViewProvider,
  smellsCacheManager: SmellsCacheManager,
): Promise<void> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Scanning for Python files in ${path.basename(folderPath)}...`,
      cancellable: false,
    },
    async () => {
      const pythonFiles: string[] = [];

      // Recursive directory walker for Python files
      function walk(dir: string): void {
        try {
          const entries = fs.readdirSync(dir);
          for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
              walk(fullPath);
            } else if (stat.isFile() && fullPath.endsWith('.py')) {
              pythonFiles.push(fullPath);
            }
          }
        } catch (error) {
          ecoOutput.error(
            `[detection.ts] Scan error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }

      walk(folderPath);
      ecoOutput.info(`[detection.ts] Found ${pythonFiles.length} files to analyze`);

      if (pythonFiles.length === 0) {
        vscode.window.showWarningMessage(
          `No Python files found in ${path.basename(folderPath)}`,
        );
        return;
      }

      vscode.window.showInformationMessage(
        `Analyzing ${pythonFiles.length} Python files...`,
      );

      // Process each found Python file
      for (const file of pythonFiles) {
        await detectSmellsFile(file, smellsViewProvider, smellsCacheManager);
      }
    },
  );
}
