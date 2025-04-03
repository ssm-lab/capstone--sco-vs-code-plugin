import * as vscode from 'vscode';
import { SmellsCacheManager } from '../context/SmellsCacheManager';

/**
 * Manages line selection and decoration in a VS Code editor, specifically for
 * displaying comments related to code smells.
 */
export class LineSelectionManager {
  private decoration: vscode.TextEditorDecorationType | null = null;
  private lastDecoratedLine: number | null = null;

  constructor(private smellsCacheManager: SmellsCacheManager) {
    // Listen for smell cache being cleared for any file
    this.smellsCacheManager.onSmellsUpdated((targetFilePath) => {
      if (targetFilePath === 'all') {
        this.removeLastComment();
        return;
      }

      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor && activeEditor.document.uri.fsPath === targetFilePath) {
        this.removeLastComment();
      }
    });
  }

  /**
   * Removes the last applied decoration from the editor, if any.
   */
  public removeLastComment(): void {
    if (this.decoration) {
      this.decoration.dispose();
      this.decoration = null;
    }
    this.lastDecoratedLine = null;
  }

  /**
   * Adds a comment to the currently selected line in the editor.
   */
  public commentLine(editor: vscode.TextEditor): void {
    if (!editor) return;

    const filePath = editor.document.fileName;
    const smells = this.smellsCacheManager.getCachedSmells(filePath);
    if (!smells) {
      this.removeLastComment(); // If cache is gone, clear any previous comment
      return;
    }

    const { selection } = editor;
    if (!selection.isSingleLine) return;

    const selectedLine = selection.start.line;

    if (this.lastDecoratedLine === selectedLine) return;

    this.removeLastComment();
    this.lastDecoratedLine = selectedLine;

    const smellsAtLine = smells.filter((smell) =>
      smell.occurences.some((occ) => occ.line === selectedLine + 1),
    );

    if (smellsAtLine.length === 0) return;

    let comment = `🍂 Smell: ${smellsAtLine[0].symbol}`;
    if (smellsAtLine.length > 1) {
      comment += ` | (+${smellsAtLine.length - 1})`;
    }

    const themeColor = new vscode.ThemeColor('editorLineNumber.foreground');
    this.decoration = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      after: {
        contentText: comment,
        color: themeColor,
        margin: '0 0 0 10px',
        textDecoration: 'none',
      },
    });

    const lineText = editor.document.lineAt(selectedLine).text;
    const range = new vscode.Range(
      selectedLine,
      0,
      selectedLine,
      lineText.trimEnd().length + 1,
    );

    editor.setDecorations(this.decoration, [range]);
  }
}
