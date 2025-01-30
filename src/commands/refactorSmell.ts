import * as vscode from 'vscode';
import { RefactorManager } from '../ui/refactorManager';
import { getEditorAndFilePath } from '../utils/editorUtils';
import { FileHighlighter } from '../ui/fileHighlighter';
import { Smell } from '../types';
import { fetchSmells, refactorSmell } from '../api/backend';
import * as fs from 'fs';
import { ContextManager } from '../context/contextManager';
import { envConfig } from '../utils/envConfig';

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

export async function refactorSelectedSmell(contextManager: ContextManager) {
  const { editor, filePath } = getEditorAndFilePath();

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

  const matchingSmells = smellsData.filter((smell: Smell) => {
    return selectedLine === smell.occurences[0].line;
  });

  if (matchingSmells.length === 0) {
    vscode.window.showInformationMessage(
      'Eco: Selected line(s) does not include a refactorable code pattern. Please switch to a line with highlighted code smell.'
    );
    return;
  }

  vscode.window.showInformationMessage(
    'Eco: Refactoring smell on selected line.'
  );
  console.log('Detecting smells in detectSmells on selected line');

  //refactor the first found smell
  //TODO UI that allows users to choose the smell to refactor
  const refactorResult = await refactorLine(
    matchingSmells[0],
    filePath,
    contextManager
  );
  if (!refactorResult) {
    vscode.window.showErrorMessage(
      'Eco: Refactoring failed. See console for details.'
    );
    return;
  }
  const { refactoredData, updatedSmells } = refactorResult;

  if (!refactoredData) {
    vscode.window.showErrorMessage(
      'Eco: Refactoring failed. See console for details.'
    );
    return;
  }

  // Did not test this yet, but if it works need to change so that all modified files are displayed
  // only shows the file where the smell was found
  console.log(`target file: ${refactoredData.targetFile}`);
  // fs.readFile(refactoredData.targetFile, async (err, data) => {
  //   if (err) {
  //     throw err;
  //   }
  //   await RefactorManager.previewRefactor(editor, data.toString('utf8'));
  //   vscode.window.showInformationMessage(
  //     `Eco: Refactoring completed. Energy difference: ${refactoredData.energySaved.toFixed(
  //       4
  //     )}`
  //   );
  // });

  if (updatedSmells.length) {
    const fileHighlighter = new FileHighlighter(contextManager);
    fileHighlighter.highlightSmells(editor, smellsData);
  } else {
    vscode.window.showWarningMessage(
      'Eco: No updated smells detected after refactoring.'
    );
  }
}
