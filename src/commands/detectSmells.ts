import * as vscode from 'vscode';
import { fetchSmells } from '../api/backend';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { getEnabledSmells } from '../utils/smellsData';
import { serverStatus, ServerStatusType } from '../emitters/serverStatus';
import { SmellsCacheManager } from '../context/SmellsCacheManager';

/**
 * Detects code smells for a given file.
 * Uses cached smells if available; otherwise, fetches from the backend.
 *
 * @param smellsViewProvider - UI provider for updating tree view.
 * @param filePath - The VS Code file URI or string path of the file to analyze.
 */
export async function detectSmellsFile(
  filePath: string,
  smellsViewProvider: SmellsViewProvider,
  smellsCacheManager: SmellsCacheManager,
): Promise<void> {
  // STEP 0: Check cache first
  if (smellsCacheManager.hasCachedSmells(filePath)) {
    const cached = smellsCacheManager.getCachedSmells(filePath);
    vscode.window.showInformationMessage('Using cached smells for this file.');
    if (cached && cached.length > 0) {
      smellsViewProvider.setStatus(filePath, 'passed');
      // TODO: render cached smells in tree
    } else {
      smellsViewProvider.setStatus(filePath, 'no_issues');
    }
    return;
  }

  // STEP 1: Check if server is down
  if (serverStatus.getStatus() === ServerStatusType.DOWN) {
    vscode.window.showWarningMessage(
      'Action blocked: Server is down and no cached smells exist for this file version.',
    );
    smellsViewProvider.setStatus(filePath, 'server_down');
    return;
  }

  // STEP 2: Get enabled smells
  const enabledSmells = getEnabledSmells();
  if (Object.keys(enabledSmells).length === 0) {
    vscode.window.showWarningMessage(
      'No enabled smells found. Please configure enabled smells in the settings.',
    );
    return;
  }

  const enabledSmellsForBackend = Object.fromEntries(
    Object.entries(enabledSmells).map(([key, value]) => [key, value.options]),
  );

  // STEP 3: Queue analysis
  smellsViewProvider.setStatus(filePath, 'queued');

  try {
    const { smells, status } = await fetchSmells(filePath, enabledSmellsForBackend);

    if (status === 200) {
      if (smells.length > 0) {
        smellsViewProvider.setStatus(filePath, 'passed');
        await smellsCacheManager.setCachedSmells(filePath, smells);
        // TODO: render smells in tree
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
