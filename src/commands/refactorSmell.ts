import * as vscode from 'vscode';
import { RefactorManager } from '../ui/refactorManager';
import { getEditorAndFilePath } from '../utils/editorUtils';
import { FileHighlighter } from '../ui/fileHighlighter';
import { refactorSmell } from '../api/backend';
import { Smell } from '../types';
import * as fs from 'fs';
import { ContextManager } from '../context/contextManager';
import { showDiffViewer } from '../ui/diffViewer';
import { envConfig } from '../utils/envConfig';
import path from 'path';

async function refactorLine(
  smell: Smell,
  filePath: string,
  contextManager: ContextManager
) {
  try {
    vscode.window.showInformationMessage(
      `Eco: Smell ID ${smell.messageId} on line ${smell.occurences[0].line}`
    );
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
  smellId?: string
) {
  const { editor, filePath } = getEditorAndFilePath();

  if (!editor || !filePath) {
    vscode.window.showErrorMessage('Eco: Unable to proceed as no active editor or file path found.');
    return;
  }

  const selectedLine = editor.selection.start.line + 1; // Update to VS Code editor indexing

  const smellsData: Smell[] = contextManager.getWorkspaceData(
    envConfig.SMELL_MAP_KEY!
  )[filePath].smells;

  if (!smellsData || smellsData.length === 0) {
    vscode.window.showErrorMessage('Eco: No smells detected in the file for refactoring.');
    return;
  }

  // Find the smell to refactor
  let smellToRefactor: Smell | undefined;
  if (smellId) {
    smellToRefactor = smellsData.find((smell: Smell) => smell.messageId === smellId);
  } else {
    smellToRefactor = smellsData.find((smell: Smell) => selectedLine === smell.occurences[0].line);
  }

  if (!smellToRefactor) {
    vscode.window.showErrorMessage('Eco: No matching smell found for refactoring.');
    return;
  }

  // Refactor the smell
  const refactorResult = await refactorLine(smellToRefactor, filePath, contextManager);

  if (!refactorResult || !refactorResult.refactoredData) {
    vscode.window.showErrorMessage('Eco: Refactoring failed. See console for details.');
    return;
  }

  const { refactoredData } = refactorResult;

  //Read the refactored code
  const refactoredCode = await fs.promises.readFile(refactoredData.targetFile, 'utf8');

  //Get the original code from the editor
  const originalCode = editor.document.getText();

  //Show the diff viewer
  await showDiffViewer(editor, refactoredCode, originalCode);

  // Clean up temporary files
  await fs.promises.rm(refactoredData.tempDir, { recursive: true, force: true });
}

export async function refactorAllSmellsOfType(
  contextManager: ContextManager,
  smellId: string
) {
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

      fs.readFile(refactorResult.refactoredData.targetFile, (err, data) => {
        if (!err) {
          combinedRefactoredData += data.toString('utf8');
        }
      });

      totalEnergySaved += refactorResult.refactoredData.energySaved;

      if (refactorResult.updatedSmells) {
        allUpdatedSmells = [
          ...allUpdatedSmells,
          ...refactorResult.updatedSmells
        ];
      }
    }
  }

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
