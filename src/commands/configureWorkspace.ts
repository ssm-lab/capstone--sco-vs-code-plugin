import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { MetricsViewProvider } from '../providers/MetricsViewProvider';

/**
 * Prompts the user to configure a workspace by selecting either a Python file or folder.
 * Updates the workspace state accordingly and refreshes the tree view to reflect the changes.
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

async function configurePythonFile(
  context: vscode.ExtensionContext,
  smellsViewProvider: SmellsViewProvider,
  metricsViewProvider: MetricsViewProvider,
) {
  const openEditorFiles = vscode.window.tabGroups.activeTabGroup.tabs
    .map((tab) => (tab.input as any)?.uri?.fsPath)
    .filter((filePath) => filePath && filePath.endsWith('.py'));

  const workspaceFiles = await vscode.workspace.findFiles(
    '**/*.py',
    '**/node_modules/**',
  );
  const workspaceFilePaths = workspaceFiles.map((uri) => uri.fsPath);

  const allPythonFiles = Array.from(
    new Set([...openEditorFiles, ...workspaceFilePaths]),
  );

  if (allPythonFiles.length === 0) {
    vscode.window.showErrorMessage(
      'No Python files found in open editors or workspace.',
    );
    return;
  }

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

function findPythonFoldersRecursively(folderPath: string): string[] {
  let pythonFolders: string[] = [];
  let hasPythonFiles = false;

  try {
    const files = fs.readdirSync(folderPath);

    // Check if current folder contains Python files or __init__.py
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

    // Only add this folder if it or its subfolders contain Python
    if (hasPythonFiles) {
      pythonFolders.push(folderPath);
    }
  } catch (error) {
    console.error(`Error scanning folder ${folderPath}:`, error);
  }

  return pythonFolders;
}

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

  const validPythonFolders = workspaceFolders
    .map((folder) => folder.uri.fsPath)
    .flatMap((folderPath) => findPythonFoldersRecursively(folderPath));

  if (validPythonFolders.length === 0) {
    vscode.window.showErrorMessage(
      'No valid Python folders found in your workspace.',
    );
    return;
  }

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

export async function updateWorkspace(
  context: vscode.ExtensionContext,
  workspacePath: string,
  smellsViewProvider: SmellsViewProvider,
  metricsViewProvider: MetricsViewProvider,
) {
  await context.workspaceState.update('workspaceConfiguredPath', workspacePath);

  vscode.commands.executeCommand(
    'setContext',
    'workspaceState.workspaceConfigured',
    true,
  );

  smellsViewProvider.refresh();
  metricsViewProvider.refresh();
}
