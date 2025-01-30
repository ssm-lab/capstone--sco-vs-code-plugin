import * as vscode from 'vscode';
import { diffWords } from 'diff';

/**
 * Displays a WebView panel to show a visual diff between the original and refactored code.
 * Users can accept or reject the changes.
 */
export async function showDiffViewer(editor: vscode.TextEditor, refactoredCode: string, originalCode: string) {
  const panel = vscode.window.createWebviewPanel(
    'ecoDiffViewer',
    'Eco: Code Refactor Preview',
    vscode.ViewColumn.Two,
    { enableScripts: true }
  );

  const diffHtml = generateDiffHtml(originalCode, refactoredCode);
  
  panel.webview.html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Eco: Code Refactor Preview</title>
      <style>
        body { font-family: monospace; padding: 10px; }
        .diff-container { display: flex; gap: 10px; }
        .code-box { flex: 1; padding: 10px; border: 1px solid #ccc; overflow: auto; }
        .removed { background-color: #ffdddd; }
        .added { background-color: #ddffdd; }
        button { margin-top: 10px; padding: 5px 10px; cursor: pointer; }
      </style>
    </head>
    <body>
      <h2>Refactoring Preview</h2>
      <div class="diff-container">
        <div class="code-box" id="original">${diffHtml.original}</div>
        <div class="code-box" id="refactored">${diffHtml.refactored}</div>
      </div>
      <button id="accept">✅ Accept</button>
      <button id="reject">❌ Reject</button>

      <script>
        const vscode = acquireVsCodeApi();
        document.getElementById('accept').addEventListener('click', () => {
          vscode.postMessage({ command: 'accept' });
        });
        document.getElementById('reject').addEventListener('click', () => {
          vscode.postMessage({ command: 'reject' });
        });
      </script>
    </body>
    </html>
  `;

  // Handle messages from WebView
  panel.webview.onDidReceiveMessage(
    (message) => {
      if (message.command === 'accept') {
        applyRefactoredCode(editor, refactoredCode);
        panel.dispose();
      } else if (message.command === 'reject') {
        panel.dispose();
      }
    },
    []
  );
}

/**
 * Generates side-by-side HTML diff highlighting differences.
 */
function generateDiffHtml(original: string, refactored: string) {
  const diff = diffWords(original, refactored);

  let originalHtml = '';
  let refactoredHtml = '';

  diff.forEach((part) => {
    if (part.added) {
      refactoredHtml += `<span class="added">${part.value}</span>`;
    } else if (part.removed) {
      originalHtml += `<span class="removed">${part.value}</span>`;
    } else {
      originalHtml += part.value;
      refactoredHtml += part.value;
    }
  });

  return { original: originalHtml, refactored: refactoredHtml };
}

/**
 * Replaces the selected code in the editor with the refactored version.
 */
function applyRefactoredCode(editor: vscode.TextEditor, newCode: string) {
  editor.edit((editBuilder) => {
    const fullRange = new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(editor.document.lineCount, 0)
    );
    editBuilder.replace(fullRange, newCode);
  });
}
