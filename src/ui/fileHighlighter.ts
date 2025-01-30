import * as vscode from 'vscode';
import { getEditor } from '../utils/editorUtils';
import { ContextManager } from '../context/contextManager';

export class FileHighlighter {
  private contextManager;
  private decoration: vscode.TextEditorDecorationType | null = null;

  public constructor(contextManager: ContextManager) {
    this.contextManager = contextManager;
  }

  public resetHighlights() {
    if (this.decoration) {
      console.log('Removing decoration');
      this.decoration.dispose();
    }
  }

  public highlightSmells(editor: vscode.TextEditor, smells: Smell[]) {
    this.resetHighlights();

    const underline = vscode.window.createTextEditorDecorationType({
      textDecoration: 'wavy rgba(76, 245, 96, 0.62) underline 1px'
    });

    const flashlight = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: 'rgba(249, 209, 10, 0.3)'
    });

    const aLittleExtra = vscode.window.createTextEditorDecorationType({
      borderWidth: '1px 2px 1px 0', // Top, Right, Bottom, No Left border
      borderStyle: 'solid',
      borderColor: 'rgba(76, 245, 96, 0.62)', // Change as needed
      after: {
        contentText: '▶', // Unicode right arrow
        margin: '0 0 0 5px', // Space between line and arrow
        color: 'rgba(76, 245, 96, 0.62)',
        fontWeight: 'bold'
      },
      overviewRulerColor: 'rgba(76, 245, 96, 0.62)',
      overviewRulerLane: vscode.OverviewRulerLane.Right
    });

    const padding = vscode.window.createTextEditorDecorationType({
      after: {
        contentText: ' '
      }
    });

    const smellLines: vscode.DecorationOptions[] = smells
      .filter((smell: Smell) =>
        smell.occurences.every((occurrence: { line: number }) =>
          isValidLine(occurrence.line)
        )
      )
      .map((smell: Smell) => {
        const line = smell.occurences[0].line - 1; // convert to zero-based line index for VS editor

        const line_text = editor.document.lineAt(line).text;
        const line_length = line_text.length;
        const indexStart = line_length - line_text.trimStart().length;
        const indexEnd = line_text.trimEnd().length + 2;

        const range = new vscode.Range(line, indexStart, line, indexEnd);

        return { range, hoverMessage: `Smell: ${smell.message}` }; // option to hover over and read smell details
      });

    this.decoration = aLittleExtra;

    editor.setDecorations(padding, smellLines);
    editor.setDecorations(this.decoration, smellLines);

    console.log('Updated smell line highlights');
  }
}

function isValidLine(line: any): boolean {
  return (
    line !== undefined &&
    line !== null &&
    typeof line === 'number' &&
    Number.isFinite(line) &&
    line > 0 &&
    Number.isInteger(line) &&
    line <= getEditor()!.document.lineCount
  );
}
