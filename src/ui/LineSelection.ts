import * as vscode from 'vscode';
import { SmellsCacheManager } from '../context/SmellsCacheManager';

/**
 * Manages line selection and decoration in a VS Code editor, specifically for
 * displaying comments related to code smells.
 */
export class LineSelectionManager {
  private decoration: vscode.TextEditorDecorationType | null = null;

  /**
   * Constructs a new instance of the `LineSelectionManager`.
   *
   * @param smellsCacheManager - An instance of `SmellsCacheManager` used to retrieve cached smells for a file.
   */
  public constructor(private smellsCacheManager: SmellsCacheManager) {}

  /**
   * Removes the last applied decoration from the editor, if any.
   *
   * This method ensures that only one decoration is applied at a time by disposing
   * of the previous decoration before applying a new one.
   */
  public removeLastComment(): void {
    if (this.decoration) {
      ecoOutput.appendLine('Removing decoration');
      this.decoration.dispose();
    }
  }

  /**
   * Adds a comment to the currently selected line in the editor, indicating the presence
   * of code smells. If multiple smells are present, it displays the first smell and a count
   * of additional smells.
   *
   * @param editor - The active `vscode.TextEditor` instance where the comment will be applied.
   *
   * @remarks
   * - If no smells are cached for the file, or if the selection spans multiple lines, no comment is added.
   * - The comment is displayed as a decoration appended to the end of the selected line.
   */
  public commentLine(editor: vscode.TextEditor): void {
    this.removeLastComment();

    if (!editor) {
      return;
    }

    const filePath = editor.document.fileName;
    const smells = this.smellsCacheManager.getCachedSmells(filePath);

    if (!smells) {
      return;
    }

    const { selection } = editor;

    if (!selection.isSingleLine) {
      return;
    }

    const selectedLine = selection.start.line;
    ecoOutput.appendLine(`selection: ${selectedLine}`);

    const smellsAtLine = smells.filter((smell: Smell) => {
      return smell.occurences[0].line === selectedLine + 1;
    });

    if (smellsAtLine.length === 0) {
      return;
    }

    let comment;

    if (smellsAtLine.length > 1) {
      comment = `🍂 Smell: ${smellsAtLine[0].symbol} | (+${
        smellsAtLine.length - 1
      })`;
    } else {
      comment = `🍂 Smell: ${smellsAtLine[0].symbol}`;
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

    const selectionLine: vscode.Range[] = [];

    // Calculate the range for the decoration based on the line's content.
    const line_text = editor.document.lineAt(selectedLine).text;
    const line_length = line_text.length;
    const indexStart = line_length - line_text.trimStart().length;
    const indexEnd = line_text.trimEnd().length + 1;

    selectionLine.push(
      new vscode.Range(selectedLine, indexStart, selectedLine, indexEnd),
    );

    editor.setDecorations(this.decoration, selectionLine);
  }
}
