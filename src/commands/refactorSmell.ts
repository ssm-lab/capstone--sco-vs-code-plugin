import * as vscode from 'vscode';
import * as fs from 'fs';

import { envConfig } from '../utils/envConfig';

import { getEditorAndFilePath } from '../utils/editorUtils';
import { refactorSmell } from '../api/backend';

import { FileHighlighter } from '../ui/fileHighlighter';
import { serverStatus } from '../utils/serverStatus';
import { ServerStatusType } from '../utils/serverStatus';
import { SmellsCacheManager } from '../context/SmellsCacheManager';

/* istanbul ignore next */
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
): Promise<RefactorOutput | undefined> {
  try {
    const refactorResult = await refactorSmell(filePath, smell);
    return refactorResult;
  } catch (error) {
    console.error('Error refactoring smell:', error);
    vscode.window.showErrorMessage((error as Error).message);
    return;
  }
}

export async function refactorSelectedSmell(
  context: vscode.ExtensionContext,
  smellsCacheManager: SmellsCacheManager,
  smellGiven?: Smell,
): Promise<void> {
  const { editor, filePath } = getEditorAndFilePath();

  const pastData = context.workspaceState.get<RefactoredData>(
    envConfig.CURRENT_REFACTOR_DATA_KEY!,
  );

  // Clean up temp directory if not removed
  if (pastData) {
    console.log('cleaning up temps');
    cleanTemps(pastData);
  }

  if (!editor || !filePath) {
    vscode.window.showErrorMessage(
      'Eco: Unable to proceed as no active editor or file path found.',
    );
    return;
  }

  const selectedLine = editor.selection.start.line + 1; // Update to VS Code editor indexing

  const smellsData = smellsCacheManager.getCachedSmells(filePath);

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
      const result = await refactorLine(smellToRefactor, filePath);

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

  await startRefactoringSession(context, editor, refactoredData);

  if (refactorResult.updatedSmells.length) {
    const fileHighlighter = FileHighlighter.getInstance(context, smellsCacheManager);
    fileHighlighter.highlightSmells(editor, refactorResult.updatedSmells);
  } else {
    vscode.window.showWarningMessage(
      'Eco: No updated smells detected after refactoring.',
    );
  }
}

export async function refactorAllSmellsOfType(
  // eslint-disable-next-line unused-imports/no-unused-vars
  context: vscode.ExtensionContext,
  // eslint-disable-next-line unused-imports/no-unused-vars
  smellsCacheManager: SmellsCacheManager,
  // eslint-disable-next-line unused-imports/no-unused-vars
  smellId: string,
): Promise<void> {
  // const { editor, filePath } = getEditorAndFilePath();
  // const pastData = contextManager.getWorkspaceData<RefactoredData>(
  //   envConfig.CURRENT_REFACTOR_DATA_KEY!,
  // );
  // // Clean up temp directory if not removed
  // if (pastData) {
  //   cleanTemps(pastData);
  // }
  // if (!editor) {
  //   vscode.window.showErrorMessage(
  //     'Eco: Unable to proceed as no active editor found.',
  //   );
  //   console.log('No active editor found to refactor smell. Returning back.');
  //   return;
  // }
  // if (!filePath) {
  //   vscode.window.showErrorMessage(
  //     'Eco: Unable to proceed as active editor does not have a valid file path.',
  //   );
  //   console.log('No valid file path found to refactor smell. Returning back.');
  //   return;
  // }
  // // only account for one selection to be refactored for now
  // // const selectedLine = editor.selection.start.line + 1; // update to VS code editor indexing
  // const smellsData: Smell[] = contextManager.getWorkspaceData(
  //   envConfig.SMELL_MAP_KEY!,
  // )[filePath].smells;
  // if (!smellsData || smellsData.length === 0) {
  //   vscode.window.showErrorMessage(
  //     'Eco: No smells detected in the file for refactoring.',
  //   );
  //   console.log('No smells found in the file for refactoring.');
  //   return;
  // }
  // // Filter smells by the given type ID
  // const smellsOfType = smellsData.filter(
  //   (smell: Smell) => smell.messageId === smellId,
  // );
  // if (smellsOfType.length === 0) {
  //   vscode.window.showWarningMessage(
  //     `Eco: No smells of type ${smellId} found in the file.`,
  //   );
  //   return;
  // }
  // let combinedRefactoredData = '';
  // let totalEnergySaved = 0;
  // let allUpdatedSmells: Smell[] = [];
  // // Refactor each smell of the given type
  // for (const smell of smellsOfType) {
  //   const refactorResult = await refactorLine(smell, filePath);
  //   if (refactorResult && refactorResult.refactoredData) {
  //     // Add two newlines between each refactored result
  //     if (combinedRefactoredData) {
  //       combinedRefactoredData += '\n\n';
  //     }
  //     fs.readFile(
  //       refactorResult.refactoredData.targetFile.refactored,
  //       (err, data) => {
  //         if (!err) {
  //           combinedRefactoredData += data.toString('utf8');
  //         }
  //       },
  //     );
  //     totalEnergySaved += refactorResult.refactoredData.energySaved;
  //     if (refactorResult.updatedSmells) {
  //       allUpdatedSmells = [...allUpdatedSmells, ...refactorResult.updatedSmells];
  //     }
  //   }
  // }
  // /*
  //   Once all refactorings are merge, need to write to a file so that it has a path that
  //   will be the new `targetFile`. Also need to reconstruct the `RefactoredData` object
  //   by combining all `affectedFiles` merge to new paths if applicable. Once implemented,
  //   just uncomment lines below and pass in the refactoredData.
  // */
  // // Tentative data structure to be built below, change inputs as needed but needs
  // // to implement the `MultiRefactoredData` interface
  // // For any temp files that need to be written due to merging, I'd suggest writing them all
  // // to one temp directory and add that directory to allTempDirs, that way they will be removed
  // // UNCOMMENT ME WHEN READY
  // // const combinedRefactoredData: MultiRefactoredData = {
  // //   targetFile: combinedTargetFile,
  // //   affectedFiles: allAffectedFiles,
  // //   energySaved: totalEnergySaved,
  // //   tempDirs: allTempDirs
  // // }
  // // UNCOMMENT ME WHEN READY
  // // startRefactoringSession(contextManager,editor,combinedRefactoredData);
  // if (combinedRefactoredData) {
  //   // await RefactorManager.previewRefactor(editor, combinedRefactoredData);
  //   vscode.window.showInformationMessage(
  //     `Eco: Refactoring completed. Total energy difference: ${totalEnergySaved.toFixed(
  //       4,
  //     )}`,
  //   );
  // } else {
  //   vscode.window.showErrorMessage(
  //     'Eco: Refactoring failed. See console for details.',
  //   );
  //   return;
  // }
  // if (allUpdatedSmells.length) {
  //   const fileHighlighter = FileHighlighter.getInstance(contextManager);
  //   fileHighlighter.highlightSmells(editor, allUpdatedSmells);
  // } else {
  //   vscode.window.showWarningMessage(
  //     'Eco: No updated smells detected after refactoring.',
  //   );
  // }
}

/* istanbul ignore next */
async function startRefactoringSession(
  context: vscode.ExtensionContext,
  editor: vscode.TextEditor,
  refactoredData: RefactoredData | MultiRefactoredData,
): Promise<void> {
  // Store only the diff editor state
  await context.workspaceState.update(
    envConfig.CURRENT_REFACTOR_DATA_KEY!,
    refactoredData,
  );

  vscode.window.showInformationMessage(
    'Hey Niv, this needs to be connected to the new refactor sidebar :)',
  );

  // await vscode.commands.executeCommand('extension.refactorSidebar.focus');

  // //Read the refactored code
  // const refactoredCode = vscode.Uri.file(refactoredData.targetFile.refactored);

  // //Get the original code from the editor
  // const originalCode = editor.document.uri;

  // const allFiles: ChangedFile[] = [
  //   refactoredData.targetFile,
  //   ...refactoredData.affectedFiles,
  // ].map((file) => {
  //   return {
  //     original: vscode.Uri.file(file.original).toString(),
  //     refactored: vscode.Uri.file(file.refactored).toString(),
  //   };
  // });

  // await contextManager.setWorkspaceData(envConfig.ACTIVE_DIFF_KEY!, {
  //   files: allFiles,
  //   firstOpen: true,
  //   isOpen: true,
  // });

  // await setTimeout(500);

  // const doc = await vscode.workspace.openTextDocument(originalCode);
  // await vscode.window.showTextDocument(doc, { preview: false });

  // //Show the diff viewer
  // sidebarState.isOpening = true;
  // vscode.commands.executeCommand(
  //   'vscode.diff',
  //   originalCode,
  //   refactoredCode,
  //   'Refactoring Comparison',
  // );
  // vscode.commands.executeCommand('ecooptimizer.showRefactorSidebar');
  // sidebarState.isOpening = false;
}

export async function cleanTemps(pastData: any): Promise<void> {
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
