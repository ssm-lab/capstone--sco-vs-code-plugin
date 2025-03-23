import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { MetricsViewProvider } from '../providers/MetricsViewProvider';

/**
 * Prompts the user to configure a workspace by selecting either a Python file or folder.
 * Updates the workspace state accordingly and refreshes the tree view to reflect the changes.
 *
 * @param context - The extension context for managing workspace state.
 * @param smellsViewProvider - The provider for the smells view.
 * @param metricsViewProvider - The provider for the metrics view.
 */
export async function configureWorkspace(
  context: vscode.ExtensionContext,
  smellsViewProvider: SmellsViewProvider,
  metricsViewProvider: MetricsViewProvider,
) {
  const choice = await vscode.window.showQuickPick(
    ['Configure a Python File', 'Configure a Python Folder'],
    { placeHolder: 'Choose whether to configure a Python file or folder.' },
  );

  if (!choice) return;

  if (choice === 'Configure a Python File') {
    await configurePythonFile(context, smellsViewProvider, metricsViewProvider);
  } else {
    await configurePythonFolder(context, smellsViewProvider, metricsViewProvider);
  }
}

/**
 * Configures the workspace using a selected Python file.
 * Prompts the user to select a Python file from open editors or the workspace.
 *
 * @param context - The extension context for managing workspace state.
 * @param smellsViewProvider - The provider for the smells view.
 * @param metricsViewProvider - The provider for the metrics view.
 */
async function configurePythonFile(
  context: vscode.ExtensionContext,
  smellsViewProvider: SmellsViewProvider,
  metricsViewProvider: MetricsViewProvider,
) {
  // Get Python files from open editors
  const openEditorFiles = vscode.window.tabGroups.activeTabGroup.tabs
    .map((tab) => (tab.input as any)?.uri?.fsPath)
    .filter((filePath) => filePath && filePath.endsWith('.py'));

  // Get Python files from the workspace
  const workspaceFiles = await vscode.workspace.findFiles(
    '**/*.py',
    '**/node_modules/**',
  );
  const workspaceFilePaths = workspaceFiles.map((uri) => uri.fsPath);

  // Combine and deduplicate file paths
  const allPythonFiles = Array.from(
    new Set([...openEditorFiles, ...workspaceFilePaths]),
  );

  if (allPythonFiles.length === 0) {
    vscode.window.showErrorMessage(
      'No Python files found in open editors or workspace.',
    );
    return;
  }

  // Prompt the user to select a Python file
  const selectedFile = await vscode.window.showQuickPick(allPythonFiles, {
    placeHolder: 'Select a Python file to use as your workspace.',
  });

  if (selectedFile) {
    await updateWorkspace(
      context,
      selectedFile,
      smellsViewProvider,
      metricsViewProvider,
    );
    vscode.window.showInformationMessage(
      `Workspace configured for file: ${path.basename(selectedFile)}`,
    );
  }
}

/**
 * Recursively scans a folder to find subfolders containing Python files or __init__.py.
 *
 * @param folderPath - The path of the folder to scan.
 * @returns An array of folder paths that contain Python files.
 */
function findPythonFoldersRecursively(folderPath: string): string[] {
  let pythonFolders: string[] = [];
  let hasPythonFiles = false;

  try {
    const files = fs.readdirSync(folderPath);

    // Check if the current folder contains Python files or __init__.py
    if (
      files.includes('__init__.py') ||
      files.some((file) => file.endsWith('.py'))
    ) {
      hasPythonFiles = true;
    }

    // Recursively scan subfolders
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      if (fs.statSync(filePath).isDirectory()) {
        const subfolderPythonFolders = findPythonFoldersRecursively(filePath);
        if (subfolderPythonFolders.length > 0) {
          hasPythonFiles = true;
          pythonFolders.push(...subfolderPythonFolders);
        }
      }
    }

    // Only add this folder if it or its subfolders contain Python files
    if (hasPythonFiles) {
      pythonFolders.push(folderPath);
    }
  } catch (error) {
    // Log the error and notify the user
    vscode.window.showErrorMessage(
      `Error scanning folder ${folderPath}: ${(error as Error).message}`,
    );
  }

  return pythonFolders;
}

/**
 * Configures the workspace using a selected Python folder.
 * Prompts the user to select a folder containing Python files from the workspace.
 *
 * @param context - The extension context for managing workspace state.
 * @param smellsViewProvider - The provider for the smells view.
 * @param metricsViewProvider - The provider for the metrics view.
 */
async function configurePythonFolder(
  context: vscode.ExtensionContext,
  smellsViewProvider: SmellsViewProvider,
  metricsViewProvider: MetricsViewProvider,
) {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage(
      'No workspace folders found. Open a project in Explorer first.',
    );
    return;
  }

  // Find all valid Python folders in the workspace
  const validPythonFolders = workspaceFolders
    .map((folder) => folder.uri.fsPath)
    .flatMap((folderPath) => findPythonFoldersRecursively(folderPath));

  if (validPythonFolders.length === 0) {
    vscode.window.showErrorMessage(
      'No valid Python folders found in your workspace.',
    );
    return;
  }

  // Prompt the user to select a Python folder
  const selectedFolder = await vscode.window.showQuickPick(validPythonFolders, {
    placeHolder: 'Select a Python folder to use as your workspace.',
  });

  if (selectedFolder) {
    await updateWorkspace(
      context,
      selectedFolder,
      smellsViewProvider,
      metricsViewProvider,
    );
    vscode.window.showInformationMessage(
      `Workspace configured for folder: ${path.basename(selectedFolder)}`,
    );
  }
}

/**
 * Updates the workspace configuration and refreshes the views.
 *
 * @param context - The extension context for managing workspace state.
 * @param workspacePath - The path of the selected workspace (file or folder).
 * @param smellsViewProvider - The provider for the smells view.
 * @param metricsViewProvider - The provider for the metrics view.
 */
export async function updateWorkspace(
  context: vscode.ExtensionContext,
  workspacePath: string,
  smellsViewProvider: SmellsViewProvider,
  metricsViewProvider: MetricsViewProvider,
) {
  // Update the workspace state with the selected path
  await context.workspaceState.update('workspaceConfiguredPath', workspacePath);

  // Set the workspace context to indicate that the workspace is configured
  vscode.commands.executeCommand(
    'setContext',
    'workspaceState.workspaceConfigured',
    true,
  );

  // Refresh the views to reflect the changes
  smellsViewProvider.refresh();
  metricsViewProvider.refresh();
}
