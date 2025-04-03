import {basename} from 'path';
import { envConfig } from '../utils/envConfig';
import { serverStatus } from '../emitters/serverStatus';
import { ServerStatusType } from '../emitters/serverStatus';
import { ecoOutput } from '../extension';

// Base URL for backend API endpoints constructed from environment configuration
const BASE_URL = `http://${envConfig.SERVER_URL}`;

/**
 * Verifies backend service availability and updates extension status.
 * Performs health check by hitting the /health endpoint and handles three scenarios:
 * 1. Successful response (200-299) - marks server as UP
 * 2. Error response - marks server as DOWN with status code
 * 3. Network failure - marks server as DOWN with error details
 */
export async function checkServerStatus(): Promise<void> {
  try {
    ecoOutput.info('[backend.ts] Checking backend server health status...');
    const response = await fetch(`${BASE_URL}/health`);
    
    if (response.ok) {
      serverStatus.setStatus(ServerStatusType.UP);
      ecoOutput.trace('[backend.ts] Backend server is healthy');
    } else {
      serverStatus.setStatus(ServerStatusType.DOWN);
      ecoOutput.warn(`[backend.ts] Backend server unhealthy status: ${response.status}`);
    }
  } catch (error) {
    serverStatus.setStatus(ServerStatusType.DOWN);
    ecoOutput.error(
      `[backend.ts] Server connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
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
      ecoOutput.error(
        `Unable to initialize logging: ${JSON.stringify(response)}`,
      );

      return false;
    }

    return true;
  } catch (error: any) {
    console.error(`Eco: Unable to initialize logging: ${error.message}`);
    ecoOutput.error(
      'Eco: Unable to reach the backend. Please check your connection.',
    );
    return false;
  }
}

/**
 * Analyzes source code for code smells using backend detection service.
 * @param filePath - Absolute path to the source file for analysis
 * @param enabledSmells - Configuration object specifying which smells to detect
 * @returns Promise resolving to smell detection results and HTTP status
 * @throws Error when:
 * - Network request fails
 * - Backend returns non-OK status
 * - Response contains invalid data format
 */
export async function fetchSmells(
  filePath: string,
  enabledSmells: Record<string, Record<string, number | string>>,
): Promise<{ smells: Smell[]; status: number }> {
  const url = `${BASE_URL}/smells`;
  const fileName = basename(filePath);
  ecoOutput.info(`[backend.ts] Starting smell detection for: ${fileName}`);

  try {
    ecoOutput.debug(`[backend.ts] Request payload for ${fileName}:`, {
      file_path: filePath,
      enabled_smells: enabledSmells
    });

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
      const errorMsg = `Backend request failed (${response.status})`;
      ecoOutput.error(`[backend.ts] ${errorMsg}`);
      try {
        const errorBody = await response.json();
        ecoOutput.error(`[backend.ts] Backend error details:`, errorBody);
      } catch (e: any) {
        ecoOutput.error(`[backend.ts] Could not parse error response`);
      }
      throw new Error(errorMsg);
    }

    const smellsList = await response.json();
    
    // Detailed logging of the response
    ecoOutput.info(`[backend.ts] Detection complete for ${fileName}`);
    ecoOutput.debug(`[backend.ts] Raw response headers for ${fileName}:`, Object.fromEntries(response.headers.entries()));
    ecoOutput.debug(`[backend.ts] Full response for ${fileName}:`, {
      status: response.status,
      statusText: response.statusText,
      body: smellsList
    });
    
    // Detailed smell listing
    ecoOutput.info(`[backend.ts] Detected ${smellsList.length} smells in ${fileName}`);
    if (smellsList.length > 0) {
      ecoOutput.debug(`[backend.ts] Complete smells list for ${fileName}:`, smellsList);
      ecoOutput.debug(`[backend.ts] Verbose smell details for ${fileName}:`, 
        smellsList.map((smell: Smell) => ({
          type: smell.symbol,
          location: `${smell.path}:${smell.occurences}`,
          message: smell.message,
          context: smell.messageId
        }))
      );
    }

    return { smells: smellsList, status: response.status };

  } catch (error: any) {
    ecoOutput.error(`[backend.ts] Smell detection failed for ${fileName}: ${error.message}`);
    if (error instanceof Error && error.stack) {
      ecoOutput.trace(`[backend.ts] Error stack info:`, error.stack);
    }
    throw new Error(`Detection failed: ${error.message}`);
  }
}

/**
 * Executes code refactoring for a specific detected smell pattern.
 * @param smell - The smell object containing detection details
 * @param workspacePath - The path to the workspace.
 * @returns Promise resolving to refactoring result data
 * @throws Error when:
 * - Workspace path is not provided
 * - Refactoring request fails
 * - Network errors occur
 */
export async function backendRefactorSmell(
  smell: Smell,
  workspacePath: string,
): Promise<RefactoredData> {
  const url = `${BASE_URL}/refactor`;

  // Validate workspace configuration
  if (!workspacePath) {
    ecoOutput.error('[backend.ts] Refactoring aborted: No workspace path');
    throw new Error('No workspace path provided');
  }

  ecoOutput.info(`[backend.ts] Starting refactoring for smell: ${smell.symbol}`);
  console.log('Starting refactoring for smell:', smell);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceDir: workspacePath,
        smell,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      ecoOutput.error(`[backend.ts] Refactoring failed: ${errorData.detail || 'Unknown error'}`);
      throw new Error(errorData.detail || 'Refactoring failed');
    }

    const result = await response.json();
    ecoOutput.info(`[backend.ts] Refactoring successful for ${smell.symbol}`);
    return result;

  } catch (error: any) {
    ecoOutput.error(`[backend.ts] Refactoring error: ${error.message}`);
    throw new Error(`Refactoring failed: ${error.message}`);
  }
}

/**
 * Sends a request to the backend to refactor all smells of a type.
 *
 * @param smell - The smell to refactor.
 * @param workspacePath - The path to the workspace.
 * @returns A promise resolving to the refactored data or throwing an error if unsuccessful.
 */
export async function backendRefactorSmellType(
  smell: Smell,
  workspacePath: string
): Promise<RefactoredData> {
  const url = `${BASE_URL}/refactor-by-type`;
  const filePath = smell.path;
  const smellType = smell.symbol;

  // Validate workspace configuration
  if (!workspacePath) {
    ecoOutput.error('[backend.ts] Refactoring aborted: No workspace path');
    throw new Error('No workspace path provided');
  }

  ecoOutput.info(`[backend.ts] Starting refactoring for smells of type "${smellType}" in "${filePath}"`);

  // Prepare the payload for the backend
  const payload = {
    sourceDir: workspacePath,
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
      ecoOutput.error(`[backend.ts] Refactoring failed: ${errorData.detail || 'Unknown error'}`);
      throw new Error(errorData.detail || 'Refactoring failed');
    }

    const result = await response.json();
    ecoOutput.info(`[backend.ts] Refactoring successful for ${smell.symbol}`);
    return result;
    
  } catch (error: any) {
    ecoOutput.error(`[backend.ts] Refactoring error: ${error.message}`);
    throw new Error(`Refactoring failed: ${error.message}`);
  }
}