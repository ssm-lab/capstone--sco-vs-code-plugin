import * as vscode from 'vscode';
import * as fs from 'fs';

import { getEditorAndFilePath } from '../utils/editorUtils';
import { refactorAllSmellsOfAType } from '../api/backend';


import { FileHighlighter } from '../ui/fileHighlighter';
import { ContextManager } from '../context/contextManager';
import { setTimeout } from 'timers/promises';
import { envConfig } from '../utils/envConfig';

async function refactorEachOccurence(
    smell: Smell,
    filePath: string,
  ) {
    try {
      const refactorResult = await refactorAllSmellsOfAType(filePath, smell);
      return refactorResult;
    } catch (error) {
      console.error('Error refactoring smell:', error);
      vscode.window.showErrorMessage(`Eco: Error refactoring smell: ${error}`);
      return;
    }
  }
  
export async function refactorAllSmellType(
  contextManager: ContextManager,
  smell?: Smell
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

  const smellsData: Smell[] = contextManager.getWorkspaceData(
    envConfig.SMELL_MAP_KEY!
  )[filePath].smells;

  if (!smellsData || smellsData.length === 0) {
    vscode.window.showErrorMessage(
      'Eco: No smells detected in the file for refactoring.'
    );
    return;
  }

  if (!smell) {
    vscode.window.showErrorMessage('Eco: No smell type provided.');
    return;
  }

  const refactorResult = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Refactoring all '${smell?.messageId}' smells in the file...`
    },
    async () => {
      const result = await refactorEachOccurence(smell, filePath);
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
      `Eco: No updated smells detected after refactoring '${smell?.messageId}'.`
    );
  }
}


async function startRefactoringSession(
    contextManager: ContextManager,
    editor: vscode.TextEditor,
    refactoredData: RefactoredData
  ) {
    // Store only the diff editor state
    await contextManager.setWorkspaceData('refactorData', refactoredData);
  
    await vscode.commands.executeCommand('extension.refactorSidebar.focus');
  
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
    vscode.commands.executeCommand(
      'vscode.diff',
      originalCode,
      refactoredCode,
      'Refactoring Comparison'
    );
    vscode.commands.executeCommand('ecooptimizer-vs-code-plugin.showRefactorSidebar');
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
  