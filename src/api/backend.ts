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

/**
 * Initializes and synchronizes logs with the backend.
 * 
 * @param {string} log_dir - The directory where logs are stored.
 * @returns {Promise<boolean>} - Returns `true` if the logs are successfully initialized and synchronized, otherwise throws an error.
 * @throws {Error} - Throws an error if the initialization fails due to network issues or backend errors.
 */
export async function initLogs(log_dir: string): Promise<boolean> {
  const url = `${BASE_URL}/logs/init`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ log_dir }),
    });

    if (!response.ok) {
      throw new Error(`Unable to initialize logging: ${response.statusText}`);
    }

    return true;
  } catch (error: any) {
    if (error instanceof Error) {
      throw new Error(`Eco: Unable to initialize logging: ${error.message}`);
    } else {
      throw new Error('Eco: An unexpected error occurred while initializing logs.');
    }
  }
}

/**
 * Sends a request to the backend to detect code smells in the specified file.
 * 
 * @param filePath - The absolute path to the file being analyzed.
 * @param enabledSmells - A dictionary containing enabled smells and their configured options.
 * @returns A promise resolving to the backend response or throwing an error if unsuccessful.
 */
export async function fetchSmells(
  filePath: string,
  enabledSmells: Record<string, Record<string, number | string>>
): Promise<{ smells: Smell[]; status: number }> {
  const url = `${BASE_URL}/smells`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file_path: filePath,
        enabled_smells: enabledSmells,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Backend request failed with status ${response.status}: ${response.statusText}`
      );
    }

    const smellsList = await response.json();

    if (!Array.isArray(smellsList)) {
      throw new Error("Unexpected response format from backend.");
    }

    return { smells: smellsList, status: response.status };
  } catch (error: any) {
    throw new Error(
      `Failed to connect to the backend: ${error.message}. Please check your network and try again.`
    );
  }
}


/**
 * Refactors a specific code smell in a given file.
 * 
 * @param {string} filePath - The path to the file containing the code smell.
 * @param {Smell} smell - The code smell to refactor.
 * @returns {Promise<RefactorOutput>} - The result of the refactoring operation.
 * @throws {Error} - Throws an error if the workspace folder cannot be determined, the API request fails, or an unexpected error occurs.
 */
export async function refactorSmell(
  filePath: string,
  smell: Smell,
): Promise<RefactorOutput> {
  const url = `${BASE_URL}/refactor`;

  const workspaceFolder = vscode.workspace.workspaceFolders?.find((folder) =>
    filePath.includes(folder.uri.fsPath),
  );

  if (!workspaceFolder) {
    throw new Error(`Unable to determine workspace folder for file: ${filePath}`);
  }

  const workspaceFolderPath = workspaceFolder.uri.fsPath;

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
      throw new Error(`Refactoring failed for smell "${smell.symbol}": ${errorText}`);
    }

    const refactorResult = (await response.json()) as RefactorOutput;
    return refactorResult;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Unexpected error during refactoring: ${error.message}`);
    } else {
      throw new Error('An unexpected error occurred during refactoring.');
    }
  }
}