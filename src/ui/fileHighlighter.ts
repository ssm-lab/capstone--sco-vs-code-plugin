import * as vscode from 'vscode';
import { getEditor } from '../utils/editorUtils';
import { ContextManager } from '../context/contextManager';
import { HoverManager } from './hoverManager';
import { SMELL_MAP } from '../utils/smellDetails';

export class FileHighlighter {
  private contextManager;
  private decorations: vscode.TextEditorDecorationType[] = [];

  public constructor(contextManager: ContextManager) {
    this.contextManager = contextManager;
  }

  public resetHighlights() {
    if (this.decorations.length > 0) {
      console.log('Removing decorations');
      this.decorations.forEach((decoration) => {
        decoration.dispose();
      });
    }
  }

  public highlightSmells(editor: vscode.TextEditor, smells: Smell[]) {
    this.resetHighlights();

    const activeSmells = new Set<string>(smells.map((smell) => smell.messageId));

    activeSmells.forEach((smellType) => {
      this.highlightSmell(editor, smells, smellType);
    });

    console.log('Updated smell line highlights');
  }

  public highlightSmell(
    editor: vscode.TextEditor,
    smells: Smell[],
    targetSmell: string
  ) {
    const smellLines: vscode.DecorationOptions[] = smells
      .filter((smell: Smell) => {
        const valid = smell.occurences.every((occurrence: { line: number }) =>
          isValidLine(occurrence.line)
        );
        const isCorrectType = smell.messageId === targetSmell;
        return valid && isCorrectType;
      })
      .map((smell: Smell) => {
        const line = smell.occurences[0].line - 1; // convert to zero-based line index for VS editor

        const line_text = editor.document.lineAt(line).text;
        const line_length = line_text.length;
        const indexStart = line_length - line_text.trimStart().length;
        const indexEnd = line_text.trimEnd().length + 2;

        const range = new vscode.Range(line, indexStart, line, indexEnd);

        const hoverManager = HoverManager.getInstance(this.contextManager, smells);
        return { range, hoverMessage: hoverManager.hoverContent || undefined }; // option to hover over and read smell details
      });

    const colorOfSmell = SMELL_MAP.get(targetSmell)!.colour;

    editor.setDecorations(this.getDecoration(colorOfSmell), smellLines);
  }

  private getDecoration(color: string) {
    // ================= EXTRA DECORATIONS ===========================
    const underline = vscode.window.createTextEditorDecorationType({
      textDecoration: `wavy ${color} underline 1px`
    });

    const flashlight = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: color
    });
    // ================================================================

    const aLittleExtra = vscode.window.createTextEditorDecorationType({
      borderWidth: '1px 2px 1px 0', // Top, Right, Bottom, No Left border
      borderStyle: 'solid',
      borderColor: color, // Change as needed
      after: {
        contentText: '▶', // Unicode right arrow
        margin: '0 0 0 5px', // Space between line and arrow
        color: color,
        fontWeight: 'bold'
      },
      overviewRulerColor: color,
      overviewRulerLane: vscode.OverviewRulerLane.Right
    });

    const decoration = aLittleExtra; // Select decoration

    this.decorations.push(decoration);

    return decoration;
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
