import * as vscode from 'vscode';
import { getEditor } from '../utils/editorUtils';

export class FileHighlighter {
  static highlightSmells(editor: vscode.TextEditor, smells: Smell[]) {
    const yellowUnderline = vscode.window.createTextEditorDecorationType({
      textDecoration: 'underline yellow'
    });

    const decorations: vscode.DecorationOptions[] = smells
      .filter((smell: Smell) =>
        smell.occurences.every((occurrence: { line: number }) =>
          isValidLine(occurrence.line)
        )
      )
      .flatMap((smell: any) => {
        return smell.occurences.map((occurrence: { line: number }) => {
          const line = occurrence.line - 1; // convert to zero-based line index for VS editor

          const line_text = editor.document.lineAt(line).text;
          const line_length = line_text.length;
          const indexStart = line_length - line_text.trimStart().length;
          const indexEnd = line_text.trimEnd().length;

          const range = new vscode.Range(line, indexStart, line, indexEnd);

          return { range, hoverMessage: `Smell: ${smell.message}` }; // option to hover over and read smell details
        });
      });

    editor.setDecorations(yellowUnderline, decorations);
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
