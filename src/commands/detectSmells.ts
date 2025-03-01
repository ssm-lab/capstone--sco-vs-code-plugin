import * as vscode from 'vscode';

import { FileHighlighter } from '../ui/fileHighlighter';
import { getEditorAndFilePath } from '../utils/editorUtils';
import { fetchSmells } from '../api/backend';
import { ContextManager } from '../context/contextManager';
import { envConfig } from '../utils/envConfig';
import { hashContent, updateHash } from '../utils/hashDocs';
import { wipeWorkCache } from './wipeWorkCache'; // ✅ Import cache wipe function
import { serverStatus, ServerStatusType } from '../utils/serverStatus';

let serverOn: boolean = true;

serverStatus.on('change', (newStatus: ServerStatusType) => {
  console.log('Server status changed:', newStatus);
  if (newStatus === ServerStatusType.DOWN) {
    serverOn = false;
    vscode.window.showWarningMessage(
      'Smell detection limited. Only cached smells will be shown.',
    );
  } else {
    serverOn = true;
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

  // ✅ Fetch user-enabled smells
  const enabledSmells = getEnabledSmells();
  const activeSmells = Object.keys(enabledSmells).filter(
    (smell) => enabledSmells[smell],
  );

  if (activeSmells.length === 0) {
    vscode.window.showWarningMessage(
      'Eco: No smells are enabled! Detection skipped.',
    );
    console.warn('Eco: No smells are enabled. Detection will not proceed.');
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

  // ✅ Retrieve cached smells
  const allSmells: Record<string, SmellDetectRecord> =
    contextManager.getWorkspaceData(envConfig.SMELL_MAP_KEY!) || {};

  const fileSmells = allSmells[filePath];
  const currentFileHash = hashContent(editor.document.getText());

  // ✅ Function to fetch smells and update cache
  async function fetchAndStoreSmells(): Promise<Smell[] | undefined> {
    console.log(
      `Eco: Fetching smells from backend for file: ${filePath} with filters: ${activeSmells}`,
    );

    if (!filePath) {
      console.error(`Eco: File path is undefined when fetching smells.`);
      return undefined;
    }

    const smellsData = await fetchSmells(filePath, activeSmells);

    if (!smellsData || smellsData.length === 0) {
      console.log(`Eco: No smells found in file: ${filePath}`);
      vscode.window.showInformationMessage('Eco: No code smells detected.');
      return [];
    }

    console.log(
      `Eco: ${smellsData.length} smells found in ${filePath}. Updating cache.`,
    );

    // ✅ Ensure safe update of smells cache
    allSmells[filePath] = { hash: currentFileHash, smells: smellsData };
    contextManager.setWorkspaceData(envConfig.SMELL_MAP_KEY!, allSmells);

    return smellsData;
  }

  let smellsData: Smell[] | undefined;

  // ✅ **Check cache before requesting backend**
  if (fileSmells && currentFileHash === fileSmells.hash) {
    console.log(`Eco: Using cached smells for ${filePath}`);
    vscode.window.showInformationMessage(`Eco: Using cached smells for ${filePath}`);
    smellsData = fileSmells.smells;
  } else if (serverOn) {
    if (fileSmells) {
      console.log(`Eco: File changed. Updating smells.`);
    } else {
      console.log(`Eco: No cached smells found. Fetching from backend.`);
    }

    updateHash(contextManager, editor.document);
    smellsData = await fetchAndStoreSmells();
  } else {
    vscode.window.showWarningMessage(
      'Action blocked: Server is down and no cached smells exists for this file version.',
    );
    return;
  }

  if (!smellsData || smellsData.length === 0) {
    console.log(`Eco: No smells to highlight for ${filePath}.`);
    return;
  }

  console.log(`Eco: Highlighting detected smells in ${filePath}.`);
  if (!fileHighlighter) {
    fileHighlighter = new FileHighlighter(contextManager);
  }
  fileHighlighter.highlightSmells(editor, smellsData);

  vscode.window.showInformationMessage(
    `Eco: Highlighted ${smellsData.length} smells.`,
  );
}

function getEnabledSmells(): { [key: string]: boolean } {
  return vscode.workspace.getConfiguration('ecooptimizer').get('enableSmells', {});
}
