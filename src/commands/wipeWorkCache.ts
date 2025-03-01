import * as vscode from 'vscode';
import { ContextManager } from '../context/contextManager';
import { envConfig } from '../utils/envConfig';
import { updateHash } from '../utils/hashDocs';

export async function wipeWorkCache(
  contextManager: ContextManager,
  reason?: string,
): Promise<void> {
  try {
    console.log('Eco: Wiping workspace cache...');

    // Clear stored smells cache
    await contextManager.setWorkspaceData(envConfig.SMELL_MAP_KEY!, {});

    if (reason === 'manual') {
      await contextManager.setWorkspaceData(envConfig.FILE_CHANGES_KEY!, {});
    }

    // Update file hashes for all open editors
    const visibleEditors = vscode.window.visibleTextEditors;

    if (visibleEditors.length === 0) {
      console.log('Eco: No open files to update hash.');
    } else {
      console.log(`Eco: Updating cache for ${visibleEditors.length} visible files.`);
    }

    for (const editor of visibleEditors) {
      if (editor.document) {
        await updateHash(contextManager, editor.document);
      }
    }

    // ✅ Determine the appropriate message
    let message = 'Eco: Successfully wiped workspace cache! ✅';
    if (reason === 'settings') {
      message =
        'Eco: Smell detection settings changed. Cache wiped to apply updates. ✅';
    } else if (reason === 'manual') {
      message = 'Eco: Workspace cache manually wiped by user. ✅';
    }

    vscode.window.showInformationMessage(message);
    console.log('Eco:', message);
  } catch (error: any) {
    console.error('Eco: Error while wiping workspace cache:', error);
    vscode.window.showErrorMessage(
      `Eco: Failed to wipe workspace cache. See console for details.`,
    );
  }
}
