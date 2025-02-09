import * as vscode from 'vscode';

import { Smell } from '../types';

const BASE_URL = 'http://127.0.0.1:8000'; // API URL for Python backend

// ✅ Fetch detected smells for a given file (only enabled smells)
export async function fetchSmells(
  filePath: string,
  enabledSmells: string[]
): Promise<Smell[]> {
  const url = `${BASE_URL}/smells`;

  try {
    console.log(
      `Eco: Requesting smells for file: ${filePath} with filters: ${enabledSmells}`
    );

    const response = await fetch(url, {
      method: 'POST', // ✅ Send enabled smells in the request body
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ file_path: filePath, enabled_smells: enabledSmells }) // ✅ Include enabled smells
    });

    if (!response.ok) {
      console.error(
        `Eco: API request failed (${response.status} - ${response.statusText})`
      );
      vscode.window.showErrorMessage(
        `Eco: Failed to fetch smells (HTTP ${response.status})`
      );
      return [];
    }

    const smellsList = (await response.json()) as Smell[];

    if (!Array.isArray(smellsList)) {
      console.error('Eco: Invalid response format from backend.');
      vscode.window.showErrorMessage('Eco: Unexpected response from backend.');
      return [];
    }

    console.log(`Eco: Successfully retrieved ${smellsList.length} smells.`);
    return smellsList;
  } catch (error: any) {
    console.error(`Eco: Network error while fetching smells: ${error.message}`);
    vscode.window.showErrorMessage(
      'Eco: Unable to reach the backend. Please check your connection.'
    );
    return [];
  }
}

// Request refactoring for a specific smell
export async function refactorSmell(
  filePath: string,
  smell: Smell
): Promise<RefactorOutput> {
  const url = `${BASE_URL}/refactor`;

  const workspace_folder = vscode.workspace.workspaceFolders?.find((folder) =>
    filePath.includes(folder.uri.fsPath)
  )?.uri.fsPath;

  if (!workspace_folder) {
    console.error('Eco: Error - Unable to determine workspace folder for', filePath);
    throw new Error(
      `Eco: Unable to find a matching workspace folder for file: ${filePath}`
    );
  }

  console.log(
    `Eco: Initiating refactoring for smell "${smell.symbol}" in "${workspace_folder}"`
  );

  const payload = {
    source_dir: workspace_folder,
    smell
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Eco: Error - Refactoring smell "${smell.symbol}": ${errorText}`
      );
      throw new Error(`Eco: Error refactoring smell: ${errorText}`);
    }

    const refactorResult = (await response.json()) as RefactorOutput;
    console.log(`Eco: Refactoring successful for smell "${smell.symbol}"`);
    return refactorResult;
  } catch (error) {
    console.error('Eco: Unexpected error in refactorSmell:', error);
    throw error;
  }
}


// Request refactoring for all smells of a specific type
export async function refactorAllSmellsOfAType(
  filePath: string,
  smell: Smell
): Promise<RefactorOutput> {
  const url = `${BASE_URL}/refactorAll`;

  const workspace_folder = vscode.workspace.workspaceFolders?.find((folder) =>
    filePath.includes(folder.uri.fsPath)
  )?.uri.fsPath;

  console.log(`workspace folder: ${workspace_folder}`);

  const payload = {
    source_dir: workspace_folder,
    smell
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Error refactoring smell: ${await response.text()}`);
    }

    const refactorResult = (await response.json()) as RefactorOutput;
    return refactorResult;
  } catch (error) {
    console.error('Error in refactorSmell:', error);
    throw error;
  }
}
