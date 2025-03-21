
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