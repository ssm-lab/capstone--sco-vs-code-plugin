import * as vscode from 'vscode';

import { FileHighlighter } from '../ui/fileHighlighter';
import { getEditorAndFilePath } from '../utils/editorUtils';
import { fetchSmells } from '../api/backend';
import { ContextManager } from '../context/contextManager';
import { envConfig } from '../utils/envConfig';
import { hashContent, updateHash } from '../utils/hashDocs';
import { wipeWorkCache } from './wipeWorkCache'; // ✅ Import cache wipe function
import { serverStatus, ServerStatusType } from '../utils/serverStatus';

serverStatus.on('change', (newStatus: ServerStatusType) => {
  console.log('Server status changed:', newStatus);
  if (newStatus === ServerStatusType.DOWN) {
    vscode.window.showWarningMessage(
      'Smell detection limited. Only cached smells will be shown.',
    );
  }
});

export interface SmellDetectRecord {
  hash: string;
  smells: Smell[];
}

let fileHighlighter: FileHighlighter;

export async function detectSmells(contextManager: ContextManager): Promise<void> {
  const { editor, filePath } = getEditorAndFilePath();

  // ✅ Ensure an active editor exists
  if (!editor) {
    vscode.window.showErrorMessage('Eco: No active editor found.');
    console.error('Eco: No active editor found to detect smells.');
    return;
  }

  // ✅ Ensure filePath is valid
  if (!filePath) {
    vscode.window.showErrorMessage('Eco: Active editor has no valid file path.');
    console.error('Eco: No valid file path found for smell detection.');
    return;
  }

  console.log(`Eco: Detecting smells in file: ${filePath}`);

  const enabledSmells = getEnabledSmells();
  if (!Object.values(enabledSmells).includes(true)) {
    vscode.window.showWarningMessage(
      'Eco: No smells are enabled! Detection skipped.',
    );
    return;
  }

  // ✅ Check if the enabled smells have changed
  const lastUsedSmells = contextManager.getWorkspaceData(
    envConfig.LAST_USED_SMELLS_KEY!,
    {},
  );
  if (JSON.stringify(lastUsedSmells) !== JSON.stringify(enabledSmells)) {
    console.log('Eco: Smell settings have changed! Wiping cache.');
    await wipeWorkCache(contextManager, 'settings');
    contextManager.setWorkspaceData(envConfig.LAST_USED_SMELLS_KEY!, enabledSmells);
  }

  // Handle cache and previous smells
  const allSmells: Record<string, SmellDetectRecord> =
    contextManager.getWorkspaceData(envConfig.SMELL_MAP_KEY!) || {};
  const fileSmells = allSmells[filePath];
  const currentFileHash = hashContent(editor.document.getText());

  let smellsData: Smell[] | undefined;

  if (fileSmells && currentFileHash === fileSmells.hash) {
    vscode.window.showInformationMessage(`Eco: Using cached smells for ${filePath}`);

    smellsData = fileSmells.smells;
  } else if (serverStatus.getStatus() === ServerStatusType.UP) {
    updateHash(contextManager, editor.document);

    try {
      smellsData = await fetchSmells(
        filePath,
        Object.keys(enabledSmells).filter((s) => enabledSmells[s]),
      );
    } catch (err) {
      console.error(err);
      return;
    }

    if (smellsData) {
      allSmells[filePath] = { hash: currentFileHash, smells: smellsData };
      contextManager.setWorkspaceData(envConfig.SMELL_MAP_KEY!, allSmells);
    }
  } else {
    vscode.window.showWarningMessage(
      'Action blocked: Server is down and no cached smells exist for this file version.',
    );
    return;
  }

  if (!smellsData || smellsData.length === 0) {
    vscode.window.showInformationMessage('Eco: No code smells detected.');
    return;
  }

  console.log(`Eco: Highlighting detected smells in ${filePath}.`);
  if (!fileHighlighter) {
    fileHighlighter = FileHighlighter.getInstance(contextManager);
  }
  fileHighlighter.highlightSmells(editor, smellsData);

  vscode.window.showInformationMessage(
    `Eco: Highlighted ${smellsData.length} smells.`,
  );

  // Set the linting state to enabled
  contextManager.setWorkspaceData(envConfig.SMELL_LINTING_ENABLED_KEY, true);
  vscode.commands.executeCommand('setContext', 'eco.smellLintingEnabled', true);
}

export function getEnabledSmells(): { [key: string]: boolean } {
  return vscode.workspace.getConfiguration('ecooptimizer').get('enableSmells', {});
}
