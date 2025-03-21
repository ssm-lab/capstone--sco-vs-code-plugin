import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { fetchSmells } from '../api/backend';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { getEnabledSmells } from '../utils/smellsData';
import { SmellsCacheManager } from '../context/SmellsCacheManager';
import { serverStatus, ServerStatusType } from '../utils/serverStatus';

/**
 * Detects code smells for a given file.
 * Uses cached smells if available; otherwise, fetches from the backend.
 *
 * @param smellsCacheManager - Manages caching of smells and file hashes.
 * @param treeDataProvider - UI provider for updating tree view.
 * @param fileUri - The VS Code file URI or string path of the file to analyze.
 */
export async function detectSmellsFile(
  smellsCacheManager: SmellsCacheManager,
  treeDataProvider: SmellsViewProvider,
  fileUri: vscode.Uri | string,
) {
  // Validate the file URI or path
  if (!fileUri) {
    vscode.window.showErrorMessage('No file selected for analysis.');
    return;
  }

  // Convert file URI to a path if necessary
  const filePath = typeof fileUri === 'string' ? fileUri : fileUri.fsPath;

  // Handle outdated files before proceeding
  await handleOutdatedFile(filePath, smellsCacheManager, treeDataProvider);

  // Open the file and compute its hash
  const document = await vscode.workspace.openTextDocument(filePath);
  const fileContent = document.getText();

  // Store the file hash after analyzing
  await smellsCacheManager.storeFileHash(filePath, fileContent);

  // Retrieve enabled smells from configuration
  const enabledSmells = getEnabledSmells();

  // Ensure that at least one smell type is enabled
  if (Object.keys(enabledSmells).length === 0) {
    vscode.window.showWarningMessage(
      'No enabled smells found. Please configure enabled smells in the settings.',
    );
    return;
  }

  // Check if smells are already cached
  const cachedSmells = smellsCacheManager.getCachedSmells(filePath);
  if (cachedSmells !== undefined) {
    // Use cached smells if available
    vscode.window.showInformationMessage(
      `Using cached smells for ${path.basename(filePath)}.`,
    );

    if (cachedSmells.length > 0) {
      treeDataProvider.updateSmells(filePath, cachedSmells, enabledSmells);
    } else {
      treeDataProvider.updateStatus(filePath, 'no_issues');
    }

    return;
  }

  if (serverStatus.getStatus() === ServerStatusType.DOWN) {
    vscode.window.showWarningMessage(
      'Action blocked: Server is down and no cached smells exist for this file version.',
    );
    treeDataProvider.updateStatus(filePath, 'server_down');
    return;
  }

  // Update UI to indicate the file is queued for analysis
  treeDataProvider.updateStatus(filePath, 'queued');

  try {
    // Prepare enabled smells for backend request
    const enabledSmellsForBackend = Object.fromEntries(
      Object.entries(enabledSmells).map(([key, value]) => [key, value.options]),
    );

    // Request smell analysis from the backend
    const { smells, status } = await fetchSmells(filePath, enabledSmellsForBackend);

    // Handle response and update UI
    if (status === 200) {
      // Cache detected smells, even if no smells are found
      await smellsCacheManager.setCachedSmells(filePath, smells);

      // Remove the file from modifiedFiles after re-analysis
      treeDataProvider.clearOutdatedStatus(filePath);

      if (smells.length > 0) {
        treeDataProvider.updateSmells(filePath, smells, enabledSmells);
        vscode.window.showInformationMessage(
          `Analysis complete: Detected ${
            smells.length
          } code smell(s) in ${path.basename(filePath)}.`,
        );
      } else {
        treeDataProvider.updateStatus(filePath, 'no_issues'); // Update status based on backend result
        vscode.window.showInformationMessage(
          `Analysis complete: No code smells found in ${path.basename(filePath)}.`,
        );
      }
    } else {
      throw new Error(`Unexpected status code: ${status}`);
    }
  } catch (error: any) {
    // Handle errors during analysis
    treeDataProvider.updateStatus(filePath, 'failed');
    vscode.window.showErrorMessage(`Analysis failed: ${error.message}`);
  }
}

/**
 * Detects code smells for all Python files within a folder.
 * Uses cached smells where available.
 *
 * @param smellsCacheManager - Manages caching of smells and file hashes.
 * @param treeDataProvider - UI provider for updating tree view.
 * @param folderPath - The absolute path of the folder to analyze.
 */
export async function detectSmellsFolder(
  smellsCacheManager: SmellsCacheManager,
  treeDataProvider: SmellsViewProvider,
  folderPath: string,
) {
  // Notify the user that folder analysis has started
  vscode.window.showInformationMessage(
    `Detecting code smells for all Python files in: ${path.basename(folderPath)}`,
  );

  // Retrieve all Python files in the specified folder
  const pythonFiles = fs
    .readdirSync(folderPath)
    .filter((file) => file.endsWith('.py'))
    .map((file) => path.join(folderPath, file));

  // Ensure that Python files exist in the folder before analysis
  if (pythonFiles.length === 0) {
    vscode.window.showWarningMessage(
      `No Python files found in ${path.basename(folderPath)}.`,
    );
    return;
  }

  // Retrieve enabled smells from configuration
  const enabledSmells = getEnabledSmells();

  // Ensure that at least one smell type is enabled
  if (Object.keys(enabledSmells).length === 0) {
    vscode.window.showWarningMessage(
      'No enabled smells found. Please configure enabled smells in the settings.',
    );
    return;
  }

  // Analyze each Python file in the folder
  for (const file of pythonFiles) {
    await detectSmellsFile(smellsCacheManager, treeDataProvider, file);
  }

  // Refresh UI to reflect folder analysis results
  treeDataProvider.refresh();
}

/**
 * Handles outdated files before detecting smells.
 * Deletes cached smells and updates the UI for outdated files.
 *
 * @param filePath - The path of the file to analyze.
 * @param smellsCacheManager - Manages caching of smells and file hashes.
 * @param smellsDisplayProvider - The UI provider for updating the tree view.
 */
async function handleOutdatedFile(
  filePath: string,
  smellsCacheManager: SmellsCacheManager,
  smellsDisplayProvider: SmellsViewProvider,
) {
  // Check if the file is marked as outdated
  if (smellsDisplayProvider.isFileOutdated(filePath)) {
    // Delete cached smells for the outdated file
    await smellsCacheManager.clearCachedSmellsForFile(filePath);

    // Remove the outdated status from the UI
    smellsDisplayProvider.updateStatus(filePath, 'queued'); // Reset to "queued" or another default status
  }
}
