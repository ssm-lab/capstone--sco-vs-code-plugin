import * as vscode from 'vscode';

import { ContextManager } from '../context/contextManager';
import { envConfig } from '../utils/envConfig';
import { updateHash } from '../utils/hashDocs';

export async function wipeWorkCache(contextManager: ContextManager) {
  contextManager.setWorkspaceData(envConfig.SMELL_MAP_KEY!, {});
  contextManager.setWorkspaceData(envConfig.SMELL_MAP_KEY!, {});

  vscode.window.visibleTextEditors.forEach(async (editor) => {
    if (editor.document) {
      await updateHash(contextManager, editor.document);
    }
  });
}
