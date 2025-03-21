import * as vscode from 'vscode';
import { SmellsCacheManager } from '../context/SmellsCacheManager';

export class LineSelectionManager {
  private decoration: vscode.TextEditorDecorationType | null = null;

  public constructor(private smellsCacheManager: SmellsCacheManager) {}

  public removeLastComment(): void {
    if (this.decoration) {
      console.log('Removing decoration');
      this.decoration.dispose();
    }
  }

  public commentLine(editor: vscode.TextEditor): void {
    this.removeLastComment();

    if (!editor) {
      return;
    }

    const filePath = editor.document.fileName;
    const smells = this.smellsCacheManager.getCachedSmells(filePath);

    if (!smells || smells.length === 0) {
      return;
    }

    const { selection } = editor;

    if (!selection.isSingleLine) {
      return;
    }

    const selectedLine = selection.start.line;
    console.log(`selection: ${selectedLine}`);

    const smellsAtLine = smells.filter((smell) => {
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

    this.decoration = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      after: {
        contentText: comment,
        color: 'rgb(153, 211, 212)',
        margin: '0 0 0 10px',
        textDecoration: 'none',
      },
    });

    const selectionLine: vscode.Range[] = [];

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
