import * as vscode from 'vscode';
import { FileHighlighter } from '../ui/fileHighlighter';
import { getEditorAndFilePath } from '../utils/editorUtils';
import * as fs from 'fs';
import { Smell } from '../types';
import { fetchSmells } from '../api/backend';
import { ContextManager } from '../context/contextManager';
import { envConfig } from '../utils/envConfig';

export interface SmellDetectRecord {
  hash: string;
  smells: Smell[];
}

export async function getSmells(
  filePath: string,
  contextManager: ContextManager
) {
  try {
    const smellsList: Smell[] = await fetchSmells(filePath);
    if (smellsList.length === 0) {
      throw new Error('Detected smells data is invalid or empty.');
    }

    return smellsList;
  } catch (error) {
    console.error('Error detecting smells:', error);
    vscode.window.showErrorMessage(`Eco: Error detecting smells: ${error}`);
    return;
  }
}

export async function detectSmells(contextManager: ContextManager) {
  const { editor, filePath } = getEditorAndFilePath();

  if (!editor) {
    vscode.window.showErrorMessage(
      'Eco: Unable to proceed as no active editor found.'
    );
    console.error('No active editor found to detect smells. Returning back.');
    return;
  }
  if (!filePath) {
    vscode.window.showErrorMessage(
      'Eco: Unable to proceed as active editor does not have a valid file path.'
    );
    console.error('No valid file path found to detect smells. Returning back.');
    return;
  }

  vscode.window.showInformationMessage('Eco: Detecting smells...');
  console.log('Detecting smells in detectSmells');

  let smellsData: Smell[] | undefined;

  // Get the stored smells and current file hash
  const allSmells = contextManager.getWorkspaceData(
    envConfig.SMELL_MAP_KEY!
  ) as Record<string, SmellDetectRecord>;

  const fileSmells = allSmells[filePath];

  const currentFileHash = contextManager.getWorkspaceData(
    envConfig.FILE_CHANGES_KEY!
  )[filePath];

  // Function to handle the smells data retrieval and updating
  async function fetchAndStoreSmells(): Promise<Smell[] | undefined> {
    smellsData = await getSmells(filePath!, contextManager);

    if (!smellsData) {
      console.log('No valid smells data found. Returning.');
      vscode.window.showErrorMessage(
        'Eco: No smells are present in current file.'
      );
      return undefined; // Indicate failure to fetch smells
    }

    allSmells[filePath!] = {
      hash: currentFileHash,
      smells: smellsData
    };
    contextManager.setWorkspaceData(envConfig.SMELL_MAP_KEY!, allSmells);

    return smellsData; // Successfully fetched and stored smells
  }

  if (fileSmells) {
    if (currentFileHash === fileSmells.hash) {
      smellsData = fileSmells.smells;
    } else {
      smellsData = await fetchAndStoreSmells();
      if (!smellsData) {
        return;
      }
    }
  } else {
    smellsData = await fetchAndStoreSmells();
    if (!smellsData) {
      return;
    }
  }

  console.log('Saving smells to workspace data.');

  console.log('Detected smells data: ', smellsData);
  vscode.window.showInformationMessage(
    `Eco: Detected ${smellsData.length} smells in the file.`
  );

  const fileHighlighter = new FileHighlighter(contextManager);
  fileHighlighter.highlightSmells(editor, smellsData);
  vscode.window.showInformationMessage(
    'Eco: Detected code smells have been highlighted.'
  );
}
