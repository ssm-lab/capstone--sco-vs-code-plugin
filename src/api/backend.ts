import { envConfig } from '../utils/envConfig';
import { serverStatus } from '../emitters/serverStatus';
import { ServerStatusType } from '../emitters/serverStatus';
import * as vscode from 'vscode';

const BASE_URL = `http://${envConfig.SERVER_URL}`; // API URL for Python backend

/**
 * Checks the status of the backend server.
 */
export async function checkServerStatus(): Promise<void> {
  try {
    const response = await fetch(`${BASE_URL}/health`);
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
 * Initializes and synchronizes logs with the backend server.
 *
 * This function sends a POST request to the backend to initialize logging
 * for the specified log directory. If the request is successful, logging
 * is initialized; otherwise, an error is logged, and an error message is
 * displayed to the user.
 *
 * @param log_dir - The directory path where logs are stored.
 * @returns A promise that resolves to `true` if logging is successfully initialized,
 *          or `false` if an error occurs.
 */
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

/**
 * Sends a request to the backend to detect code smells in the specified file.
 *
 * @param filePath - The absolute path to the file being analyzed.
 * @param enabledSmells - A dictionary containing enabled smells and their configured options.
 * @returns A promise resolving to the backend response or throwing an error if unsuccessful.
 */
export async function fetchSmells(
  filePath: string,
  enabledSmells: Record<string, Record<string, number | string>>,
): Promise<{ smells: Smell[]; status: number }> {
  const url = `${BASE_URL}/smells`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_path: filePath,
        enabled_smells: enabledSmells,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Backend request failed with status ${response.status}: ${response.statusText}`,
      );
    }

    const smellsList = await response.json();

    if (!Array.isArray(smellsList)) {
      throw new Error('Unexpected response format from backend.');
    }

    return { smells: smellsList, status: response.status };
  } catch (error: any) {
    throw new Error(
      `Failed to connect to the backend: ${error.message}. Please check your network and try again.`,
    );
  }
}

/**
 * Sends a request to the backend to refactor a specific smell.
 *
 * @param smell - The smell to refactor.
 * @returns A promise resolving to the refactored data or throwing an error if unsuccessful.
 */
export async function backendRefactorSmell(
  smell: Smell,
): Promise<RefactoredData> {
  const url = `${BASE_URL}/refactor`;

  // Extract the file path from the smell object
  const filePath = smell.path;

  // Find the workspace folder containing the file
  const workspaceFolder = vscode.workspace.workspaceFolders?.find((folder) =>
    filePath.includes(folder.uri.fsPath),
  );

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

  // Prepare the payload for the backend
  const payload = {
    sourceDir: workspaceFolderPath,
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
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Refactoring failed');
    }

    const refactorResult = (await response.json()) as RefactoredData;
    return refactorResult;
  } catch (error: any) {
    console.error('Eco: Unexpected error in refactorSmell:', error);
    throw new Error(`Refactoring failed: ${error.message}`);
  }
}

/**
 * Sends a request to the backend to refactor all smells of a type.
 *
 * @param smell - The smell to refactor.
 * @returns A promise resolving to the refactored data or throwing an error if unsuccessful.
 */
export async function backendRefactorSmellType(
  smell: Smell
): Promise<RefactoredData> {
  const url = `${BASE_URL}/refactor-by-type`;
  const filePath = smell.path;
  const smellType = smell.symbol;

  // Find the workspace folder containing the file
  const workspaceFolder = vscode.workspace.workspaceFolders?.find((folder) =>
    filePath.includes(folder.uri.fsPath),
  );

  if (!workspaceFolder) {
    console.error('Eco: Error - Unable to determine workspace folder for', filePath);
    throw new Error(
      `Eco: Unable to find a matching workspace folder for file: ${filePath}`,
    );
  }

  const workspaceFolderPath = workspaceFolder.uri.fsPath;

  console.log(
    `Eco: Initiating refactoring for smells of type "${smellType}" in "${filePath}"`,
  );

  // Prepare the payload for the backend
  const payload = {
    sourceDir: workspaceFolderPath,
    smellType,
    firstSmell: smell,
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
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Refactoring failed');
    }

    const refactorResult = (await response.json()) as RefactoredData;
    return refactorResult;
  } catch (error: any) {
    console.error('Eco: Unexpected error in refactorSmell:', error);
    throw new Error(`Refactoring failed: ${error.message}`);
  }
}