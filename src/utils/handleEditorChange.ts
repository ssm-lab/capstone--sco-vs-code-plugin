import * as vscode from 'vscode';
import { setTimeout } from 'timers/promises';

import { ContextManager } from '../context/contextManager';
import { ActiveDiff } from '../types';

interface DiffInfo {
  original: vscode.Uri;
  modified: vscode.Uri;
}

export let sidebarState = { isOpening: false };

export async function handleEditorChanges(
  contextManager: ContextManager,
  editors: readonly vscode.TextEditor[]
) {
  console.log('Detected visible editor change');
  const diffState = contextManager.getWorkspaceData<ActiveDiff>('activeDiff');
  const refactorData =
    contextManager.getWorkspaceData<RefactoredData>('refactorData');

  if (sidebarState.isOpening) {
    return;
  }

  if (!diffState) {
    console.log('No active refactoring session');
    return;
  }

  // console.log(`diffstate: ${diffState.isOpen}`);
  // console.log(`diffstate: ${JSON.stringify(diffState)}`);
  // console.log(`Editors: ${JSON.stringify(editors)}`);

  // Is a diff editor for a refactoring
  const isDiffRefactorEditor = isDiffEditorOpen(editors, diffState);

  if (diffState.isOpen) {
    // User either closed or switched diff editor
    // console.log(`refactor data: ${JSON.stringify(refactorData)}`);
    // console.log(`is diff editor: ${isDiffRefactorEditor}`);

    if (isDiffRefactorEditor === undefined) {
      return;
    }

    if ((!isDiffRefactorEditor || !refactorData) && !diffState.firstOpen) {
      console.log('Diff editor no longer active');
      diffState.isOpen = false;
      // console.log(`diffstate: ${diffState.isOpen}`);
      // console.log(`diffstate: ${JSON.stringify(diffState)}`);
      contextManager.setWorkspaceData('activeDiff', diffState);
      await setTimeout(500);
      vscode.commands.executeCommand(
        'ecooptimizer-vs-code-plugin.pauseRefactorSidebar'
      );
      return;
    }
    if (diffState.firstOpen) {
      diffState.firstOpen = false;
      contextManager.setWorkspaceData('activeDiff', diffState);
      await setTimeout(500);
    }
    // switched from one diff editor to another, no handling needed
    console.log('continuing');
    return;
  }

  // Diff editor was reopened (switch back to)
  else if (isDiffRefactorEditor) {
    console.log('Opening Sidebar');
    // console.log(`diffstate: ${diffState.isOpen}`);
    diffState.isOpen = true;
    // console.log(`diffstate: ${JSON.stringify(diffState)}`);
    contextManager.setWorkspaceData('activeDiff', diffState);
    await setTimeout(500);
    vscode.commands.executeCommand(
      'ecooptimizer-vs-code-plugin.showRefactorSidebar'
    );
  }
  console.log('Doing nothing');
}

function isDiffEditorOpen(
  editors: readonly vscode.TextEditor[],
  diffState: ActiveDiff
) {
  console.log('Checking if editor is a diff editor');
  if (!editors.length) {
    console.log('No editors found');
    return undefined;
  }

  // @ts-ignore
  const diffInfo: DiffInfo[] = editors[0].diffInformation;
  // console.log(`Diff Info: ${JSON.stringify(diffInfo)}`);

  if (!diffInfo && editors.length === 2) {
    console.log('Checking first case');

    return diffState.files.some((file) => {
      // console.log(`file: ${JSON.stringify(file)}`);
      return (
        (file.original === editors[0].document.uri.toString() &&
          file.refactored === editors[1].document.uri.toString()) ||
        (file.refactored === editors[0].document.uri.toString() &&
          file.original === editors[1].document.uri.toString())
      );
    });
  } else if (diffInfo && diffInfo.length === 1) {
    console.log('Checking second case');
    return diffState.files.some((file) => {
      // console.log(`file: ${JSON.stringify(file)}`);
      return (
        (file.original === diffInfo[0].original.toString() &&
          file.refactored === diffInfo[0].modified.toString()) ||
        (file.original === diffInfo[0].modified.toString() &&
          file.refactored === diffInfo[0].original.toString())
      );
    });
  }

  return false;
}
