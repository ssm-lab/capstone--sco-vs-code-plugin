import { envConfig } from './utils/envConfig';

import * as vscode from 'vscode';
import { detectSmells } from './commands/detectSmells';
import { refactorSelectedSmell } from './commands/refactorSmell';
import { LineSelectionManager } from './ui/lineSelectionManager';
import * as crypto from 'crypto';
import { ContextManager } from './context/contextManager';

interface Smell {
  line: number; // Known attribute
  [key: string]: any; // Index signature for unknown properties
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Refactor Plugin activated');

  const contextManager = new ContextManager(context);

  // ===============================================================
  // INITIALIZE WORKSPACE DATA
  // ===============================================================

  let allDetectedSmells = contextManager.getWorkspaceData(
    envConfig.SMELL_MAP_KEY!
  );
  let fileHashes = contextManager.getWorkspaceData(envConfig.FILE_CHANGES_KEY!);

  if (!allDetectedSmells) {
    allDetectedSmells = {};
    contextManager.setWorkspaceData(
      envConfig.SMELL_MAP_KEY!,
      allDetectedSmells
    );
  }

  if (!fileHashes) {
    fileHashes = {};
    contextManager.setWorkspaceData(envConfig.SMELL_MAP_KEY!, fileHashes);
  }

  console.log(
    `Smell detection map: ${contextManager.getWorkspaceData(
      envConfig.SMELL_MAP_KEY!
    )}`
  );

  // ===============================================================
  // REGISTER COMMANDS
  // ===============================================================

  // Register Detect Smells Command
  let detectSmellsCmd = vscode.commands.registerCommand(
    'ecooptimizer-vs-code-plugin.detectSmells',
    async () => {
      console.log('Command detectSmells triggered');
      detectSmells(contextManager);
    }
  );
  context.subscriptions.push(detectSmellsCmd);

  // Register Refactor Smell Command
  let refactorSmellCmd = vscode.commands.registerCommand(
    'ecooptimizer-vs-code-plugin.refactorSmell',
    () => {
      console.log('Command refactorSmells triggered');
      vscode.window.showInformationMessage('Eco: Detecting smells...');
      refactorSelectedSmell(contextManager);
    }
  );
  context.subscriptions.push(refactorSmellCmd);

  // ===============================================================
  // ADD LISTENERS
  // ===============================================================

  // Adds comments to lines describing the smell
  const lineSelectManager = new LineSelectionManager(contextManager);
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((event) => {
      console.log(`Detected event: ${event.kind?.toString()}`);

      lineSelectManager.commentLine(event.textEditor);
    })
  );

  // Updates directory of file states (for checking if modified)
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      await updateHash(contextManager, document);
    })
  );

  // Handles case of documents already being open on vscode open
  vscode.window.visibleTextEditors.forEach(async (editor) => {
    if (editor.document) {
      await updateHash(contextManager, editor.document);
    }
  });

  // Initializes first state of document when opened while extension active
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(
      async (document) => await updateHash(contextManager, document)
    )
  );
}

export function deactivate() {
  console.log('Refactor Plugin deactivated');
}

// ===============================================================
// UTILITY FUNCTIONS
// ===============================================================

// Function to hash the document content
export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Function to update the stored hashes in workspace storage
async function updateHash(
  contextManager: ContextManager,
  document: vscode.TextDocument
) {
  const lastSavedHashes = contextManager.getWorkspaceData(
    envConfig.FILE_CHANGES_KEY!,
    {}
  );
  const lastHash = lastSavedHashes[document.fileName];
  const currentHash = hashContent(document.getText());

  if (lastHash !== undefined && lastHash !== currentHash) {
    console.log(`Document ${document.uri.fsPath} has changed since last save.`);
    lastSavedHashes[document.fileName] = currentHash;
    await contextManager.setWorkspaceData(
      envConfig.FILE_CHANGES_KEY!,
      lastSavedHashes
    );
  }
}
