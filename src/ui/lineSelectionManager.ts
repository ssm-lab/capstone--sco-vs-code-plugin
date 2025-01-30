import * as vscode from 'vscode';
import { ContextManager } from '../context/contextManager';
import { envConfig } from '../utils/envConfig';
import { SmellDetectRecord } from '../commands/detectSmells';
import { hashContent } from '../extension';

export class LineSelectionManager {
  private contextManager;
  private decoration: vscode.TextEditorDecorationType | null = null;

  public constructor(contextManager: ContextManager) {
    this.contextManager = contextManager;
  }

  public removeLastComment() {
    if (this.decoration) {
      console.log('Removing decoration');
      this.decoration.dispose();
    }
  }

  public commentLine(editor: vscode.TextEditor) {
    this.removeLastComment();

    const filePath = editor.document.fileName;
    const smellsDetectRecord = this.contextManager.getWorkspaceData(
      envConfig.SMELL_MAP_KEY!
    )[filePath] as SmellDetectRecord;

    if (!smellsDetectRecord) {
      return;
    }

    if (smellsDetectRecord.hash !== hashContent(editor.document.getText())) {
      return;
    }

    const { selection } = editor;

    if (!selection.isSingleLine) {
      return;
    }

    const selectedLine = selection.start.line;
    console.log(`selection: ${selectedLine}`);

    const smells = smellsDetectRecord.smells;

    const smellsAtLine = smells.filter((smell) => {
      return smell.occurences[0].line === selectedLine + 1;
    });

    if (smellsAtLine.length === 0) {
      return;
    }

    let comment;

    if (smellsAtLine.length > 1) {
      comment = `🍂 Smell: ${smellsAtLine[0].symbol} | ...`;
    } else {
      comment = `🍂 Smell: ${smellsAtLine[0].symbol}`;
    }

    this.decoration = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      after: {
        contentText: comment,
        color: 'rgb(153, 211, 212)', // Red-orange for visibility
        margin: '0 0 0 10px', // Moves it to the right edge
        textDecoration: 'none'
      }
    });

    if (!editor) {
      return;
    }

    const selectionLine: vscode.Range[] = [];

    const line_text = editor.document.lineAt(selectedLine).text;
    const line_length = line_text.length;
    const indexStart = line_length - line_text.trimStart().length;
    const indexEnd = line_text.trimEnd().length + 1;

    selectionLine.push(
      new vscode.Range(selectedLine, indexStart, selectedLine, indexEnd)
    );

    editor.setDecorations(this.decoration, selectionLine);
  }
}
