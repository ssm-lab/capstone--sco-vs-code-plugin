import crypto from 'crypto';
import { ContextManager } from '../context/contextManager';
import { envConfig } from './envConfig';
import * as vscode from 'vscode';

// Function to hash the document content
export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Function to update the stored hashes in workspace storage
export async function updateHash(
  contextManager: ContextManager,
  document: vscode.TextDocument
) {
  const lastSavedHashes = contextManager.getWorkspaceData(
    envConfig.FILE_CHANGES_KEY!,
    {}
  );
  const lastHash = lastSavedHashes[document.fileName];
  const currentHash = hashContent(document.getText());

  if (!lastHash || lastHash !== currentHash) {
    console.log(`Document ${document.fileName} has changed since last save.`);
    lastSavedHashes[document.fileName] = currentHash;
    await contextManager.setWorkspaceData(
      envConfig.FILE_CHANGES_KEY!,
      lastSavedHashes
    );
  }
}
