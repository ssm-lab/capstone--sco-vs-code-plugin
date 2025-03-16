import * as vscode from 'vscode';
import * as fs from 'fs';

import { envConfig } from '../utils/envConfig';

import { getEditorAndFilePath } from '../utils/editorUtils';
import { refactorSmell, refactorSmellsByType } from '../api/backend';
import { sidebarState } from '../utils/handleEditorChange';

import { FileHighlighter } from '../ui/fileHighlighter';
import { ContextManager } from '../context/contextManager';
import { setTimeout } from 'timers/promises';
import { serverStatus } from '../utils/serverStatus';
import { ServerStatusType } from '../utils/serverStatus';

serverStatus.on('change', (newStatus: ServerStatusType) => {
  console.log('Server status changed:', newStatus);
  if (newStatus === ServerStatusType.DOWN) {
    vscode.window.showWarningMessage('No refactoring is possible at this time.');
  }
});

export interface MultiRefactoredData {
  tempDirs: string[];
  targetFile: ChangedFile;
  affectedFiles: ChangedFile[];
  energySaved: number;
}

async function refactorLine(
  smell: Smell,
  filePath: string,
  refactorByType: boolean,
): Promise<RefactorOutput | undefined> {
  try {
    if (refactorByType) {
      return await refactorSmellsByType(filePath, smell);
    }
    return await refactorSmell(filePath, smell);
  } catch (error) {
    console.error('Error refactoring smell:', error);
    vscode.window.showErrorMessage((error as Error).message);
    return;
  }
}

export async function refactorSelectedSmell(
  contextManager: ContextManager,
  refactorByType: boolean,
  smellGiven?: Smell,
): Promise<void> {
  const { editor, filePath } = getEditorAndFilePath();

  const pastData = contextManager.getWorkspaceData(
    envConfig.CURRENT_REFACTOR_DATA_KEY!,
  );

  // Clean up temp directory if not removed
  if (pastData) {
    cleanTemps(pastData);
  }

  if (!editor || !filePath) {
    vscode.window.showErrorMessage(
      'Eco: Unable to proceed as no active editor or file path found.',
    );
    return;
  }

  const selectedLine = editor.selection.start.line + 1; // Update to VS Code editor indexing

  const smellsData: Smell[] = contextManager.getWorkspaceData(
    envConfig.SMELL_MAP_KEY!,
  )[filePath].smells;

  if (!smellsData || smellsData.length === 0) {
    vscode.window.showErrorMessage(
      'Eco: No smells detected in the file for refactoring.',
    );
    return;
  }

  // Find the smell to refactor
  let smellToRefactor: Smell | undefined;
  if (smellGiven?.messageId) {
    smellToRefactor = smellsData.find(
      (smell: Smell) =>
        smell.messageId === smellGiven.messageId &&
        smellGiven.occurences[0].line === smell.occurences[0].line,
    );
  } else {
    smellToRefactor = smellsData.find(
      (smell: Smell) => selectedLine === smell.occurences[0].line,
    );
  }

  if (!smellToRefactor) {
    vscode.window.showErrorMessage('Eco: No matching smell found for refactoring.');
    return;
  }

  await vscode.workspace.save(editor.document.uri);

  const refactorResult = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Fetching refactoring for ${smellToRefactor.symbol} on line ${smellToRefactor.occurences[0].line}`,
    },
    async (_progress, _token) => {
      const result = await refactorLine(smellToRefactor, filePath, refactorByType);

      if (result && result.refactoredData) {
        vscode.window.showInformationMessage(
          'Refactoring report available in sidebar.',
        );
      }

      return result;
    },
  );

  if (!refactorResult || !refactorResult.refactoredData) {
    vscode.window.showErrorMessage(
      'Eco: Refactoring failed. See console for details.',
    );
    return;
  }

  const { refactoredData } = refactorResult;

  await startRefactoringSession(contextManager, editor, refactoredData);

  if (refactorResult.updatedSmells.length) {
    const fileHighlighter = new FileHighlighter(contextManager);
    fileHighlighter.highlightSmells(editor, refactorResult.updatedSmells);
  } else {
    vscode.window.showWarningMessage(
      'Eco: No updated smells detected after refactoring.',
    );
  }
}

async function startRefactoringSession(
  contextManager: ContextManager,
  editor: vscode.TextEditor,
  refactoredData: RefactoredData | MultiRefactoredData,
): Promise<void> {
  // Store only the diff editor state
  await contextManager.setWorkspaceData(
    envConfig.CURRENT_REFACTOR_DATA_KEY!,
    refactoredData,
  );

  await vscode.commands.executeCommand('extension.refactorSidebar.focus');

  //Read the refactored code
  const refactoredCode = vscode.Uri.file(refactoredData.targetFile.refactored);

  //Get the original code from the editor
  const originalCode = editor.document.uri;

  const allFiles: ChangedFile[] = [
    refactoredData.targetFile,
    ...refactoredData.affectedFiles,
  ].map((file) => {
    return {
      original: vscode.Uri.file(file.original).toString(),
      refactored: vscode.Uri.file(file.refactored).toString(),
    };
  });

  await contextManager.setWorkspaceData(envConfig.ACTIVE_DIFF_KEY!, {
    files: allFiles,
    firstOpen: true,
    isOpen: true,
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
    'Refactoring Comparison',
  );
  vscode.commands.executeCommand('ecooptimizer-vs-code-plugin.showRefactorSidebar');
  sidebarState.isOpening = false;
}

async function cleanTemps(pastData: any): Promise<void> {
  console.log('Cleaning up stale artifacts');
  const tempDirs =
    (pastData!.tempDir! as string) || (pastData!.tempDirs! as string[]);

  if (Array.isArray(tempDirs)) {
    for (const dir in tempDirs) {
      await fs.promises.rm(dir, { recursive: true, force: true });
    }
  } else {
    await fs.promises.rm(tempDirs, { recursive: true, force: true });
  }
}
