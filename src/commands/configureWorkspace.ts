import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Initializes workspace configuration by prompting user to select a Python project folder.
 * This is the main entry point for workspace configuration and delegates to folder-specific logic.
 *
 * @param context - VS Code extension context containing workspace state management
 */
export async function configureWorkspace(context: vscode.ExtensionContext) {
  await configurePythonFolder(context);
}

/**
 * Recursively identifies Python project folders by scanning for:
 * - Python files (*.py)
 * - __init__.py package markers
 * Maintains a hierarchical understanding of Python projects in the workspace.
 *
 * @param folderPath - Absolute filesystem path to scan
 * @returns Array of qualified Python project paths
 */
function findPythonFoldersRecursively(folderPath: string): string[] {
  let pythonFolders: string[] = [];
  let hasPythonFiles = false;

  try {
    const files = fs.readdirSync(folderPath);

    // Validate current folder contains Python artifacts
    if (
      files.includes('__init__.py') ||
      files.some((file) => file.endsWith('.py'))
    ) {
      hasPythonFiles = true;
    }

    // Recursively process subdirectories
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

    // Include current folder if Python content found at any level
    if (hasPythonFiles) {
      pythonFolders.push(folderPath);
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `Workspace scanning error in ${path.basename(folderPath)}: ${(error as Error).message}`,
    );
  }

  return pythonFolders;
}

/**
 * Guides user through Python workspace selection process with validation.
 * Presents filtered list of valid Python project folders and handles selection.
 *
 * @param context - Extension context for state persistence
 */
async function configurePythonFolder(context: vscode.ExtensionContext) {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders?.length) {
    vscode.window.showErrorMessage(
      'No workspace detected. Please open a project folder first.',
    );
    return;
  }

  // Identify all Python project roots
  const validPythonFolders = workspaceFolders
    .map((folder) => folder.uri.fsPath)
    .flatMap(findPythonFoldersRecursively);

  if (validPythonFolders.length === 0) {
    vscode.window.showErrorMessage(
      'No Python projects found. Workspace must contain .py files or __init__.py markers.',
    );
    return;
  }

  // Present interactive folder selection
  const selectedFolder = await vscode.window.showQuickPick(
    validPythonFolders.map((folder) => ({
      label: path.basename(folder),
      description: folder,
      detail: `Python content: ${fs
        .readdirSync(folder)
        .filter((file) => file.endsWith('.py') || file === '__init__.py')
        .join(', ')}`,
      folderPath: folder,
    })),
    {
      placeHolder: 'Select Python project root',
      matchOnDescription: true,
      matchOnDetail: true,
    },
  );

  if (selectedFolder) {
    await updateWorkspace(context, selectedFolder.folderPath);
    vscode.window.showInformationMessage(
      `Configured workspace: ${path.basename(selectedFolder.folderPath)}`,
    );
  }
}

/**
 * Persists workspace configuration and updates extension context.
 * Triggers view refreshes to reflect new workspace state.
 *
 * @param context - Extension context for state management
 * @param workspacePath - Absolute path to selected workspace root
 */
export async function updateWorkspace(
  context: vscode.ExtensionContext,
  workspacePath: string,
) {
  // Persist workspace path
  await context.workspaceState.update('workspaceConfiguredPath', workspacePath);

  // Update extension context for UI state management
  vscode.commands.executeCommand(
    'setContext',
    'workspaceState.workspaceConfigured',
    true,
  );
}
