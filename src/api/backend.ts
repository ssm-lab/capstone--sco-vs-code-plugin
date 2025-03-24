import { envConfig } from '../utils/envConfig';
import { serverStatus } from '../emitters/serverStatus';
import { ServerStatusType } from '../emitters/serverStatus';
import { ecoOutput } from '../extension';

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
 * @param workspacePath - The user-configured workspace root directory.
 * @returns A promise resolving to the refactored data or throwing an error if unsuccessful.
 */
export async function backendRefactorSmell(
  smell: Smell,
  workspacePath: string,
): Promise<RefactoredData> {
  const url = `${BASE_URL}/refactor`;

  if (!workspacePath) {
    throw new Error('No workspace path provided for refactoring.');
  }

  ecoOutput.appendLine(
    `Eco: Initiating refactoring for smell "${smell.symbol}" in "${workspacePath}"`,
  );

  const payload = {
    source_dir: workspacePath,
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
    console.error('Eco: Unexpected error in backendRefactorSmell:', error);
    throw new Error(`Refactoring failed: ${error.message}`);
  }
}
