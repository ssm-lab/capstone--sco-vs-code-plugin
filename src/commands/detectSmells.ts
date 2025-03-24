import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { fetchSmells } from '../api/backend';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { getEnabledSmells } from '../utils/smellsData';
import { serverStatus, ServerStatusType } from '../emitters/serverStatus';
import { SmellsCacheManager } from '../context/SmellsCacheManager';

/**
 * Runs smell detection on a single file if valid.
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

  const enabledSmells = getEnabledSmells();
  const enabledSmellsForBackend = Object.fromEntries(
    Object.entries(enabledSmells).map(([key, value]) => [key, value.options]),
  );

  try {
    const { smells, status } = await fetchSmells(filePath, enabledSmellsForBackend);

    if (status === 200) {
      if (smells.length > 0) {
        smellsViewProvider.setStatus(filePath, 'passed');
        await smellsCacheManager.setCachedSmells(filePath, smells);
        smellsViewProvider.setSmells(filePath, smells);
      } else {
        smellsViewProvider.setStatus(filePath, 'no_issues');
        await smellsCacheManager.setCachedSmells(filePath, []);
      }
    } else {
      smellsViewProvider.setStatus(filePath, 'failed');
      vscode.window.showErrorMessage(`Analysis failed (status ${status}).`);
    }
  } catch (error: any) {
    smellsViewProvider.setStatus(filePath, 'failed');
    vscode.window.showErrorMessage(`Analysis failed: ${error.message}`);
  }
}

/**
 * Validates workspace state before initiating detection.
 */
async function precheckAndMarkQueued(
  filePath: string,
  smellsViewProvider: SmellsViewProvider,
  smellsCacheManager: SmellsCacheManager,
): Promise<boolean> {
  if (smellsCacheManager.hasCachedSmells(filePath)) {
    const cached = smellsCacheManager.getCachedSmells(filePath);
    vscode.window.showInformationMessage('Using cached smells for this file.');
    if (cached && cached.length > 0) {
      smellsViewProvider.setStatus(filePath, 'passed');
      smellsViewProvider.setSmells(filePath, cached);
    } else {
      smellsViewProvider.setStatus(filePath, 'no_issues');
    }
    return false;
  }

  if (serverStatus.getStatus() === ServerStatusType.DOWN) {
    vscode.window.showWarningMessage(
      'Action blocked: Server is down and no cached smells exist for this file version.',
    );
    smellsViewProvider.setStatus(filePath, 'server_down');
    return false;
  }

  const enabledSmells = getEnabledSmells();
  if (Object.keys(enabledSmells).length === 0) {
    vscode.window.showWarningMessage(
      'No enabled smells found. Please configure enabled smells in the settings.',
    );
    return false;
  }

  smellsViewProvider.setStatus(filePath, 'queued');
  return true;
}

/**
 * Detects smells in all Python files within the selected folder.
 */
export async function detectSmellsFolder(
  folderPath: string,
  smellsViewProvider: SmellsViewProvider,
  smellsCacheManager: SmellsCacheManager,
): Promise<void> {
  const pythonFiles: string[] = [];

  function walk(dir: string): void {
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
  }

  walk(folderPath);

  for (const file of pythonFiles) {
    await detectSmellsFile(file, smellsViewProvider, smellsCacheManager);
  }
}
