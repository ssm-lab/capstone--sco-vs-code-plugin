import * as vscode from 'vscode';

import { envConfig } from '../utils/envConfig';
import { serverStatus } from '../utils/serverStatus';
import { ServerStatusType } from '../utils/serverStatus';

const BASE_URL = `http://${envConfig.SERVER_URL}`; // API URL for Python backend

export async function checkServerStatus(): Promise<void> {
  try {
    const response = await fetch('http://localhost:8000/health');
    if (response.ok) {
      serverStatus.setStatus(ServerStatusType.UP);
    } else {
      serverStatus.setStatus(ServerStatusType.DOWN);
    }
  } catch {
    serverStatus.setStatus(ServerStatusType.DOWN);
  }
}

export async function initLogs(log_dir: string): Promise<boolean> {
  const url = `${BASE_URL}/logs/init`;

  try {
    console.log('Initializing and synching logs with backend');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ log_dir }),
    });

    if (!response.ok) {
      console.error(`Unable to initialize logging: ${JSON.stringify(response)}`);

      return false;
    }

    return true;
  } catch (error: any) {
    console.error(`Eco: Unable to initialize logging: ${error.message}`);
    vscode.window.showErrorMessage(
      'Eco: Unable to reach the backend. Please check your connection.',
    );
    return false;
  }
}

// ✅ Fetch detected smells for a given file (only enabled smells)
export async function fetchSmells(
  filePath: string,
  enabledSmells: string[],
): Promise<Smell[]> {
  const url = `${BASE_URL}/smells`;

  try {
    console.log(
      `Eco: Requesting smells for file: ${filePath} with filters: ${enabledSmells}`,
    );

    const response = await fetch(url, {
      method: 'POST', // ✅ Send enabled smells in the request body
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file_path: filePath, enabled_smells: enabledSmells }), // ✅ Include enabled smells
    });

    if (!response.ok) {
      console.error(
        `Eco: API request failed (${response.status} - ${response.statusText})`,
      );
      vscode.window.showErrorMessage(
        `Eco: Failed to fetch smells`,
      );
      return [];
    }

    const smellsList = (await response.json()) as Smell[];

    if (!Array.isArray(smellsList)) {
      console.error('Eco: Invalid response format from backend.');
      vscode.window.showErrorMessage('Eco: Failed to fetch smells');
      return [];
    }

    console.log(`Eco: Successfully retrieved ${smellsList.length} smells.`);
    return smellsList;
  } catch (error: any) {
    console.error(`Eco: Network error while fetching smells: ${error.message}`);
    vscode.window.showErrorMessage(
      'Eco: Failed to fetch smells',
    );
    return [];
  }
}

// Request refactoring for a specific smell
export async function refactorSmell(
  filePath: string,
  smell: Smell,
): Promise<RefactorOutput> {
  const url = `${BASE_URL}/refactor`;

  const workspaceFolder = vscode.workspace.workspaceFolders?.find((folder) =>
    filePath.includes(folder.uri.fsPath),
  )

  if (!workspaceFolder) {
    console.error('Eco: Error - Unable to determine workspace folder for', filePath);
    throw new Error(
      `Eco: Unable to find a matching workspace folder for file: ${filePath}`,
    );
  }

  const workspaceFolderPath = workspaceFolder.uri.fsPath;

  console.log(
    `Eco: Initiating refactoring for smell "${smell.symbol}" in "${workspaceFolderPath}"`,
  );

  const payload = {
    source_dir: workspaceFolderPath,
    smell,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Eco: Error - Refactoring smell "${smell.symbol}": ${errorText}`,
      );
      throw new Error(`Eco: Error refactoring smell: ${errorText}`);
    }

    const refactorResult = (await response.json()) as RefactorOutput;
    return refactorResult;
  } catch (error) {
    console.error('Eco: Unexpected error in refactorSmell:', error);
    throw error;
  }
}
