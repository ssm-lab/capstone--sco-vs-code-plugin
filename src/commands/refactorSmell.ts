import * as vscode from 'vscode';
import * as fs from 'fs';

import { envConfig } from '../utils/envConfig';

import { getEditorAndFilePath } from '../utils/editorUtils';
import { refactorSmell } from '../api/backend';
import { sidebarState } from '../utils/handleEditorChange';

import { FileHighlighter } from '../ui/fileHighlighter';
import { ContextManager } from '../context/contextManager';
import { RefactorManager } from '../ui/refactorManager';
import { setTimeout } from 'timers/promises';

export interface MultiRefactoredData {
  tempDirs: string[];
  targetFile: ChangedFile;
  affectedFiles: ChangedFile[];
  energySaved: number;
}

async function refactorLine(
  smell: Smell,
  filePath: string,
  contextManager: ContextManager
) {
  try {
    const refactorResult = await refactorSmell(filePath, smell);
    return refactorResult;
  } catch (error) {
    console.error('Error refactoring smell:', error);
    vscode.window.showErrorMessage(`Eco: Error refactoring smell: ${error}`);
    return;
  }
}

export async function refactorSelectedSmell(
  contextManager: ContextManager,
  smellGiven?: Smell
) {
  const { editor, filePath } = getEditorAndFilePath();

  const pastData = contextManager.getWorkspaceData('refactorData');

  // Clean up temp directory if not removed
  if (pastData) {
    cleanTemps(pastData);
  }

  if (!editor || !filePath) {
    vscode.window.showErrorMessage(
      'Eco: Unable to proceed as no active editor or file path found.'
    );
    return;
  }

  const selectedLine = editor.selection.start.line + 1; // Update to VS Code editor indexing

  const smellsData: Smell[] = contextManager.getWorkspaceData(
    envConfig.SMELL_MAP_KEY!
  )[filePath].smells;

  if (!smellsData || smellsData.length === 0) {
    vscode.window.showErrorMessage(
      'Eco: No smells detected in the file for refactoring.'
    );
    return;
  }

  // Find the smell to refactor
  let smellToRefactor: Smell | undefined;
  if (smellGiven?.messageId) {
    smellToRefactor = smellsData.find(
      (smell: Smell) =>
        smell.messageId === smellGiven.messageId &&
        smellGiven.occurences[0].line === smell.occurences[0].line
    );
  } else {
    smellToRefactor = smellsData.find(
      (smell: Smell) => selectedLine === smell.occurences[0].line
    );
  }

  if (!smellToRefactor) {
    vscode.window.showErrorMessage('Eco: No matching smell found for refactoring.');
    return;
  }

  const refactorResult = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Fetching refactoring for ${smellToRefactor.symbol} on line ${smellToRefactor.occurences[0].line}`
    },
    async (progress, token) => {
      const result = await refactorLine(smellToRefactor, filePath, contextManager);

      vscode.window.showInformationMessage(
        'Refactoring report available in sidebar.'
      );

      return result;
    }
  );

  if (!refactorResult || !refactorResult.refactoredData) {
    vscode.window.showErrorMessage(
      'Eco: Refactoring failed. See console for details.'
    );
    return;
  }

  const { refactoredData } = refactorResult;

  startRefactoringSession(contextManager, editor, refactoredData);

  if (refactorResult.updatedSmells.length) {
    const fileHighlighter = new FileHighlighter(contextManager);
    fileHighlighter.highlightSmells(editor, refactorResult.updatedSmells);
  } else {
    vscode.window.showWarningMessage(
      'Eco: No updated smells detected after refactoring.'
    );
  }
}

export async function refactorAllSmellsOfType(
  contextManager: ContextManager,
  smellId: string
) {
  const { editor, filePath } = getEditorAndFilePath();

  const pastData = contextManager.getWorkspaceData<RefactoredData>('refactorData');

  // Clean up temp directory if not removed
  if (pastData) {
    cleanTemps(pastData);
  }

  if (!editor) {
    vscode.window.showErrorMessage(
      'Eco: Unable to proceed as no active editor found.'
    );
    console.log('No active editor found to refactor smell. Returning back.');
    return;
  }
  if (!filePath) {
    vscode.window.showErrorMessage(
      'Eco: Unable to proceed as active editor does not have a valid file path.'
    );
    console.log('No valid file path found to refactor smell. Returning back.');
    return;
  }

  // only account for one selection to be refactored for now
  const selectedLine = editor.selection.start.line + 1; // update to VS code editor indexing

  const smellsData: Smell[] = contextManager.getWorkspaceData(
    envConfig.SMELL_MAP_KEY!
  )[filePath].smells;

  if (!smellsData || smellsData.length === 0) {
    vscode.window.showErrorMessage(
      'Eco: No smells detected in the file for refactoring.'
    );
    console.log('No smells found in the file for refactoring.');
    return;
  }

  // Filter smells by the given type ID
  const smellsOfType = smellsData.filter(
    (smell: Smell) => smell.messageId === smellId
  );

  if (smellsOfType.length === 0) {
    vscode.window.showWarningMessage(
      `Eco: No smells of type ${smellId} found in the file.`
    );
    return;
  }

  let combinedRefactoredData = '';
  let totalEnergySaved = 0;
  let allUpdatedSmells: Smell[] = [];

  // Refactor each smell of the given type
  for (const smell of smellsOfType) {
    const refactorResult = await refactorLine(smell, filePath, contextManager);

    if (refactorResult && refactorResult.refactoredData) {
      // Add two newlines between each refactored result
      if (combinedRefactoredData) {
        combinedRefactoredData += '\n\n';
      }

      fs.readFile(
        refactorResult.refactoredData.targetFile.refactored,
        (err, data) => {
          if (!err) {
            combinedRefactoredData += data.toString('utf8');
          }
        }
      );

      totalEnergySaved += refactorResult.refactoredData.energySaved;

      if (refactorResult.updatedSmells) {
        allUpdatedSmells = [...allUpdatedSmells, ...refactorResult.updatedSmells];
      }
    }
  }

  /*
    Once all refactorings are merge, need to write to a file so that it has a path that
    will be the new `targetFile`. Also need to reconstruct the `RefactoredData` object 
    by combining all `affectedFiles` merge to new paths if applicable. Once implemented, 
    just uncomment lines below and pass in the refactoredData.
  */

  // Tentative data structure to be built below, change inputs as needed but needs
  // to implement the `MultiRefactoredData` interface

  // For any temp files that need to be written due to merging, I'd suggest writing them all
  // to one temp directory and add that directory to allTempDirs, that way they will be removed

  // UNCOMMENT ME WHEN READY
  // const combinedRefactoredData: MultiRefactoredData = {
  //   targetFile: combinedTargetFile,
  //   affectedFiles: allAffectedFiles,
  //   energySaved: totalEnergySaved,
  //   tempDirs: allTempDirs
  // }

  // UNCOMMENT ME WHEN READY
  // startRefactoringSession(contextManager,editor,combinedRefactoredData);

  if (combinedRefactoredData) {
    await RefactorManager.previewRefactor(editor, combinedRefactoredData);
    vscode.window.showInformationMessage(
      `Eco: Refactoring completed. Total energy difference: ${totalEnergySaved.toFixed(
        4
      )}`
    );
  } else {
    vscode.window.showErrorMessage(
      'Eco: Refactoring failed. See console for details.'
    );
    return;
  }

  if (allUpdatedSmells.length) {
    const fileHighlighter = new FileHighlighter(contextManager);
    fileHighlighter.highlightSmells(editor, allUpdatedSmells);
  } else {
    vscode.window.showWarningMessage(
      'Eco: No updated smells detected after refactoring.'
    );
  }
}

async function startRefactoringSession(
  contextManager: ContextManager,
  editor: vscode.TextEditor,
  refactoredData: RefactoredData | MultiRefactoredData
) {
  await vscode.commands.executeCommand('extension.refactorSidebar.focus');

  // Store only the diff editor state
  await contextManager.setWorkspaceData('refactorData', refactoredData);

  //Read the refactored code
  const refactoredCode = vscode.Uri.file(refactoredData.targetFile.refactored);

  //Get the original code from the editor
  const originalCode = editor.document.uri;

  const allFiles: ChangedFile[] = [
    refactoredData.targetFile,
    ...refactoredData.affectedFiles
  ].map((file) => {
    return {
      original: vscode.Uri.file(file.original).toString(),
      refactored: vscode.Uri.file(file.refactored).toString()
    };
  });

  await contextManager.setWorkspaceData('activeDiff', {
    files: allFiles,
    firstOpen: true,
    isOpen: true
  });

  await setTimeout(500);

  const doc = await vscode.workspace.openTextDocument(originalCode);
  await vscode.window.showTextDocument(doc, { preview: false });

  //Show the diff viewer
  sidebarState.isOpening = true;
  vscode.commands.executeCommand(
    'vscode.diff',
    originalCode,
    refactoredCode,
    'Refactoring Comparison'
  );
  vscode.commands.executeCommand('ecooptimizer-vs-code-plugin.showRefactorSidebar');
  sidebarState.isOpening = false;
}

function cleanTemps(pastData: any) {
  console.log('Cleaning up stale artifacts');
  const tempDirs = pastData!.tempDir! || pastData!.tempDirs!;

  if (Array.isArray(tempDirs)) {
    tempDirs.forEach((dir) => {
      fs.promises.rm(dir, { recursive: true });
    });
  } else {
    fs.promises.rm(tempDirs!, { recursive: true });
  }
}
