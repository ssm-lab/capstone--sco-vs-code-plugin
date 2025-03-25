import * as vscode from 'vscode';

/**
 * Jumps to a specific line in the given file within the VS Code editor.
 * @param filePath - The absolute path of the file.
 * @param line - The line number to navigate to.
 */
export async function jumpToSmell(filePath: string, line: number): Promise<void> {
  try {
    const document = await vscode.workspace.openTextDocument(filePath);
    const editor = await vscode.window.showTextDocument(document);

    // Move cursor to the specified line
    const position = new vscode.Position(line, 0);
    editor.selection = new vscode.Selection(position, position);

    const range = new vscode.Range(position, position);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

    const flashDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor('editor.wordHighlightBackground'),
      isWholeLine: true,
    });

    editor.setDecorations(flashDecorationType, [range]);

    setTimeout(() => {
      editor.setDecorations(flashDecorationType, []);
    }, 500);
  } catch (error: any) {
    vscode.window.showErrorMessage(
      `Failed to jump to smell in ${filePath}: ${error.message}`,
    );
  }
}
