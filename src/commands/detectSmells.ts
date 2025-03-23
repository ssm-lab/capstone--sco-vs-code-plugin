import * as vscode from 'vscode';
import { fetchSmells } from '../api/backend';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { getEnabledSmells } from '../utils/smellsData';
import { serverStatus, ServerStatusType } from '../emitters/serverStatus';

/**
 * Detects code smells for a given file.
 * Uses cached smells if available; otherwise, fetches from the backend.
 *
 * @param smellsViewProvider - UI provider for updating tree view.
 * @param filePath - The VS Code file URI or string path of the file to analyze.
 */
export async function detectSmellsFile(
  smellsViewProvider: SmellsViewProvider,
  filePath: string,
): Promise<void> {
  // STEP 2: Check if server is down
  if (serverStatus.getStatus() === ServerStatusType.DOWN) {
    vscode.window.showWarningMessage(
      'Action blocked: Server is down and no cached smells exist for this file version.',
    );
    smellsViewProvider.setStatus(filePath, 'server_down');
    return;
  }

  // STEP 3: Get enabled smells
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

  // STEP 4: Set status to queued
  smellsViewProvider.setStatus(filePath, 'queued');

  try {
    const { smells, status } = await fetchSmells(filePath, enabledSmellsForBackend);

    if (status === 200) {
      if (smells.length > 0) {
        smellsViewProvider.setStatus(filePath, 'passed');
        // TODO: addSmellsToTreeView(smellsViewProvider, filePath, smells);
      } else {
        smellsViewProvider.setStatus(filePath, 'no_issues');
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
