import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Prompts the user to configure a workspace by selecting either a Python file or folder.
 * Updates the workspace state accordingly and refreshes the tree view to reflect the changes.
 *
 * @param context - The extension context used to persist workspace state.
 * @param treeDataProvider - The tree data provider responsible for refreshing the workspace view.
 */
export async function configureWorkspace(
  context: vscode.ExtensionContext,
  treeDataProvider: vscode.TreeDataProvider<string>,
) {
  // Prompt the user to choose between configuring a Python file or folder
  const choice = await vscode.window.showQuickPick(
    ['Configure a Python File', 'Configure a Python Folder'],
    { placeHolder: 'Choose whether to configure a Python file or folder.' },
  );

  // Exit if the user cancels the selection
  if (!choice) return;

  // Call the appropriate function based on the user's choice
  if (choice === 'Configure a Python File') {
    await configurePythonFile(context, treeDataProvider);
  } else {
    await configurePythonFolder(context, treeDataProvider);
  }
}

/**
 * Prompts the user to select a Python file from open editors or the workspace.
 * Updates the workspace state with the selected file and refreshes the tree view.
 *
 * @param context - The extension context used to persist workspace state.
 * @param treeDataProvider - The tree data provider responsible for refreshing the workspace view.
 */
async function configurePythonFile(
  context: vscode.ExtensionContext,
  treeDataProvider: vscode.TreeDataProvider<string>,
) {
  // Retrieve Python files from open editors
  const openEditorFiles = vscode.window.tabGroups.activeTabGroup.tabs
    .map((tab) => (tab.input as any)?.uri?.fsPath)
    .filter((filePath) => filePath && filePath.endsWith('.py'));

  // Retrieve Python files from the workspace using a glob pattern
  const workspaceFiles = await vscode.workspace.findFiles(
    '**/*.py',
    '**/node_modules/**',
  );
  const workspaceFilePaths = workspaceFiles.map((uri) => uri.fsPath);

  // Combine and deduplicate the list of Python files
  const allPythonFiles = Array.from(
    new Set([...openEditorFiles, ...workspaceFilePaths]),
  );

  // Notify the user if no Python files are found
  if (allPythonFiles.length === 0) {
    vscode.window.showErrorMessage(
      'No Python files found in open editors or workspace.',
    );
    return;
  }

  // Prompt the user to select a Python file from the combined list
  const selectedFile = await vscode.window.showQuickPick(allPythonFiles, {
    placeHolder: 'Select a Python file to use as your workspace.',
  });

  // Update the workspace state and notify the user if a file is selected
  if (selectedFile) {
    await updateWorkspace(context, treeDataProvider, selectedFile);
    vscode.window.showInformationMessage(
      `Workspace configured for file: ${path.basename(selectedFile)}`,
    );
  }
}

/**
 * Prompts the user to select a Python folder from the workspace.
 * Updates the workspace state with the selected folder and refreshes the tree view.
 *
 * @param context - The extension context used to persist workspace state.
 * @param treeDataProvider - The tree data provider responsible for refreshing the workspace view.
 */
async function configurePythonFolder(
  context: vscode.ExtensionContext,
  treeDataProvider: vscode.TreeDataProvider<string>,
) {
  // Retrieve the workspace folders from the current workspace
  const workspaceFolders = vscode.workspace.workspaceFolders;

  // Notify the user if no workspace folders are found
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage(
      'No workspace folders found. Open a project in Explorer first.',
    );
    return;
  }

  // Filter workspace folders to include only those containing Python files
  const validPythonFolders = workspaceFolders
    .map((folder) => folder.uri.fsPath)
    .filter((folderPath) => containsPythonFiles(folderPath));

  // Notify the user if no valid Python folders are found
  if (validPythonFolders.length === 0) {
    vscode.window.showErrorMessage(
      'No valid Python folders found in your workspace.',
    );
    return;
  }

  // Prompt the user to select a Python folder from the filtered list
  const selectedFolder = await vscode.window.showQuickPick(validPythonFolders, {
    placeHolder: 'Select a Python folder to use as your workspace.',
  });

  // Update the workspace state and notify the user if a folder is selected
  if (selectedFolder) {
    await updateWorkspace(context, treeDataProvider, selectedFolder);
    vscode.window.showInformationMessage(
      `Workspace configured for folder: ${path.basename(selectedFolder)}`,
    );
  }
}

/**
 * Checks if a given folder contains Python files.
 * This function scans the folder for `.py` files or an `__init__.py` file.
 *
 * @param folderPath - The absolute path of the folder to check.
 * @returns True if the folder contains Python files, otherwise false.
 */
function containsPythonFiles(folderPath: string): boolean {
  try {
    // Read the contents of the folder
    const files = fs.readdirSync(folderPath);

    // Check if any file ends with `.py` or if the folder contains `__init__.py`
    return (
      files.some((file) => file.endsWith('.py')) || files.includes('__init__.py')
    );
  } catch (error) {
    // Return false if an error occurs (e.g., folder is inaccessible)
    return false;
  }
}

/**
 * Updates the workspace state to reflect the configured Python file or folder.
 * Refreshes the tree view to reflect the changes.
 *
 * @param context - The extension context used to persist workspace state.
 * @param treeDataProvider - The tree data provider responsible for refreshing the workspace view.
 * @param workspacePath - The selected workspace path (file or folder).
 */
async function updateWorkspace(
  context: vscode.ExtensionContext,
  treeDataProvider: vscode.TreeDataProvider<string>,
  workspacePath: string,
) {
  // Update the workspace state with the selected path
  await context.workspaceState.update('workspaceConfiguredPath', workspacePath);

  // Set a context variable to indicate that the workspace is configured
  vscode.commands.executeCommand(
    'setContext',
    'workspaceState.workspaceConfigured',
    true,
  );

  // Refresh the tree view to reflect the updated workspace configuration
  (treeDataProvider as any).refresh();
}
