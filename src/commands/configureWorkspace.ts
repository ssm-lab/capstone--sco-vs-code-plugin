import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Prompts the user to configure a workspace by selecting a folder containing Python files.
 * Updates the workspace state accordingly and refreshes the tree view to reflect the changes.
 *
 * @param context - The extension context for managing workspace state.
 */
export async function configureWorkspace(context: vscode.ExtensionContext) {
  // Directly configure a Python folder (removed the file option)
  await configurePythonFolder(context);
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
 */
async function configurePythonFolder(context: vscode.ExtensionContext) {
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
      'No valid Python folders found in your workspace. A valid folder must contain Python files (*.py) or an __init__.py file.',
    );
    return;
  }

  // Show folder selection dialog
  const selectedFolder = await vscode.window.showQuickPick(
    validPythonFolders.map((folder) => ({
      label: path.basename(folder),
      description: folder,
      detail: `Contains Python files: ${fs
        .readdirSync(folder)
        .filter((file) => file.endsWith('.py') || file === '__init__.py')
        .join(', ')}`,
      folderPath: folder,
    })),
    {
      placeHolder: 'Select a Python folder to use as your workspace',
      matchOnDescription: true,
      matchOnDetail: true,
    },
  );

  if (selectedFolder) {
    await updateWorkspace(context, selectedFolder.folderPath);
    vscode.window.showInformationMessage(
      `Workspace configured for folder: ${path.basename(selectedFolder.folderPath)}`,
    );
  }
}

/**
 * Updates the workspace configuration and refreshes the views.
 *
 * @param context - The extension context for managing workspace state.
 * @param workspacePath - The path of the selected workspace (file or folder).
 */
export async function updateWorkspace(
  context: vscode.ExtensionContext,
  workspacePath: string,
) {
  // Update the workspace state with the selected path
  await context.workspaceState.update('workspaceConfiguredPath', workspacePath);

  // Set the workspace context to indicate that the workspace is configured
  vscode.commands.executeCommand(
    'setContext',
    'workspaceState.workspaceConfigured',
    true,
  );
}
