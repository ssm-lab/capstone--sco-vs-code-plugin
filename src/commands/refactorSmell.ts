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

export async function refactorSelectedSmell(contextManager: ContextManager, context: vscode.ExtensionContext, smellId?: string) {
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

  // If smellId is provided, find that specific smell
  let smellToRefactor: Smell | undefined;
  if (smellId) {
    vscode.window.showInformationMessage(
      `Eco: Smell ID ${smellId}`
    );
    smellToRefactor = smellsData.find((smell: Smell) => smell.messageId === smellId);
    if (!smellToRefactor) {
      vscode.window.showErrorMessage(
        `Eco: Could not find smell with ID ${smellId}`
      );
      return;
    }
  } else {
    // Original line-based logic as fallback
    const matchingSmells = smellsData.filter((smell: Smell) => {
      return selectedLine === smell.occurences[0].line;
    });
    if (matchingSmells.length === 0) {
      vscode.window.showInformationMessage(
        'Eco: Selected line(s) does not include a refactorable code pattern. Please switch to a line with highlighted code smell.'
      );
      return;
    }
    smellToRefactor = matchingSmells[0];
  }

  console.log('Detecting smells in detectSmells on selected line');

  //refactor the selected smell
  const refactorResult = await refactorLine(
    smellToRefactor,
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
  fs.readFile(refactoredData.targetFile, async (err, data) => {
    if (err) {
      throw err;
    }
  
    // await RefactorManager.previewRefactor(editor, data.toString('utf8')); mya commented to test my difference library stuff
    await showDiffViewer(editor, data.toString('utf8'), "bumb");
    vscode.window.showInformationMessage(
      `Eco: Refactoring completed. Energy difference: ${refactoredData.energySaved.toFixed(
        4
      )}`
    );
  });

  if (updatedSmells.length) {
    const fileHighlighter = new FileHighlighter(contextManager);
    // const hoverManager = new HoverManager(context, smellsData);
    fileHighlighter.highlightSmells(editor, updatedSmells);
  } else {
    vscode.window.showWarningMessage(
      'Eco: No updated smells detected after refactoring.'
    );
  }
}

export async function refactorAllSmellsOfType(contextManager: ContextManager, context: vscode.ExtensionContext, smellId: string) {
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
  const smellsOfType = smellsData.filter((smell: Smell) => smell.messageId === smellId);

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
        allUpdatedSmells = [...allUpdatedSmells, ...refactorResult.updatedSmells];
      }
    }
  }

  if (combinedRefactoredData) {
    await RefactorManager.previewRefactor(editor, combinedRefactoredData);
    vscode.window.showInformationMessage(
      `Eco: Refactoring completed. Total energy difference: ${totalEnergySaved.toFixed(4)}`
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