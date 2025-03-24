import path from 'path';

import { envConfig } from '../utils/envConfig';
import { serverStatus } from '../emitters/serverStatus';
import { ServerStatusType } from '../emitters/serverStatus';
import { ecoOutput } from '../extension';

const BASE_URL = `http://${envConfig.SERVER_URL}`;

/**
 * Checks the health status of the backend server and updates the extension's status emitter.
 */
export async function checkServerStatus(): Promise<void> {
  try {
    ecoOutput.appendLine('[backend.ts] Checking backend server health status...');
    const response = await fetch(`${BASE_URL}/health`);
    
    if (response.ok) {
      serverStatus.setStatus(ServerStatusType.UP);
      ecoOutput.appendLine('[backend.ts] Backend server is healthy');
    } else {
      serverStatus.setStatus(ServerStatusType.DOWN);
      ecoOutput.appendLine(`[backend.ts] Backend server unhealthy status: ${response.status}`);
    }
  } catch (error) {
    serverStatus.setStatus(ServerStatusType.DOWN);
    ecoOutput.appendLine(`[backend.ts] Server connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Detects code smells in a specified file by communicating with the backend service.
 */
export async function fetchSmells(
  filePath: string,
  enabledSmells: Record<string, Record<string, number | string>>,
): Promise<{ smells: Smell[]; status: number }> {
  const url = `${BASE_URL}/smells`;
  ecoOutput.appendLine(`[backend.ts] Starting smell detection for: ${path.basename(filePath)}`);

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
      const errorMsg = `Backend request failed (${response.status})`;
      ecoOutput.appendLine(`[backend.ts] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const smellsList = await response.json();
    ecoOutput.appendLine(`[backend.ts] Detected ${smellsList.length} smells in ${path.basename(filePath)}`);
    return { smells: smellsList, status: response.status };

  } catch (error: any) {
    ecoOutput.appendLine(`[backend.ts] Smell detection failed: ${error.message}`);
    throw new Error(`Detection failed: ${error.message}`);
  }
}

/**
 * Initiates refactoring of a specific code smell through the backend service.
 */
export async function backendRefactorSmell(
  smell: Smell,
  workspacePath: string,
): Promise<RefactoredData> {
  const url = `${BASE_URL}/refactor`;

  if (!workspacePath) {
    ecoOutput.appendLine('[backend.ts] Refactoring aborted: No workspace path');
    throw new Error('No workspace path provided');
  }

  ecoOutput.appendLine(`[backend.ts] Starting refactoring for smell: ${smell.symbol}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_dir: workspacePath,
        smell,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      ecoOutput.appendLine(`[backend.ts] Refactoring failed: ${errorData.detail || 'Unknown error'}`);
      throw new Error(errorData.detail || 'Refactoring failed');
    }

    const result = await response.json();
    ecoOutput.appendLine(`[backend.ts] Refactoring successful for ${smell.symbol}`);
    return result;

  } catch (error: any) {
    ecoOutput.appendLine(`[backend.ts] Refactoring error: ${error.message}`);
    throw new Error(`Refactoring failed: ${error.message}`);
  }
}