import * as vscode from 'vscode';
import { getEditor } from '../utils/editorUtils';
import { HoverManager } from './hoverManager';
import { SmellsCacheManager } from '../context/SmellsCacheManager';

export class FileHighlighter {
  private static instance: FileHighlighter;
  private decorations: vscode.TextEditorDecorationType[] = [];

  constructor(
    private context: vscode.ExtensionContext,
    private smellsCacheManager: SmellsCacheManager,
  ) {}

  public static getInstance(
    context: vscode.ExtensionContext,
    smellsCacheManager: SmellsCacheManager,
  ): FileHighlighter {
    if (!FileHighlighter.instance) {
      FileHighlighter.instance = new FileHighlighter(context, smellsCacheManager);
    }
    return FileHighlighter.instance;
  }

  public resetHighlights(): void {
    this.decorations.forEach((decoration) => decoration.dispose());
    this.decorations = [];
  }

  public highlightSmells(editor: vscode.TextEditor, smells: Smell[]): void {
    this.resetHighlights();

    const config = vscode.workspace.getConfiguration('ecooptimizer.detection');
    const smellsConfig = config.get<{
      [key: string]: { enabled: boolean; colour: string };
    }>('smells', {});
    const useSingleColour = config.get<boolean>('useSingleColour', false);
    const singleHighlightColour = config.get<string>(
      'singleHighlightColour',
      'rgba(255, 204, 0, 0.5)',
    );
    const highlightStyle = config.get<string>('highlightStyle', 'underline');

    const activeSmells = new Set<string>(smells.map((smell) => smell.symbol));

    activeSmells.forEach((smellType) => {
      const smellConfig = smellsConfig[smellType];
      if (smellConfig?.enabled) {
        const colour = useSingleColour ? singleHighlightColour : smellConfig.colour;
        this.highlightSmell(editor, smells, smellType, colour, highlightStyle);
      }
    });
  }

  private highlightSmell(
    editor: vscode.TextEditor,
    smells: Smell[],
    targetSmell: string,
    colour: string,
    style: string,
  ): void {
    const smellLines: vscode.DecorationOptions[] = smells
      .filter((smell: Smell) => {
        const valid = smell.occurences.every((occurrence: { line: number }) =>
          isValidLine(occurrence.line),
        );
        const isCorrectType = smell.symbol === targetSmell;
        return valid && isCorrectType;
      })
      .map((smell: Smell) => {
        const line = smell.occurences[0].line - 1; // convert to zero-based line index for VS editor
        const lineText = editor.document.lineAt(line).text;
        const indexStart = lineText.length - lineText.trimStart().length;
        const indexEnd = lineText.trimEnd().length + 2;
        const range = new vscode.Range(line, indexStart, line, indexEnd);

        const hoverManager = HoverManager.getInstance(
          this.context,
          this.smellsCacheManager,
          smells,
        );
        return { range, hoverMessage: hoverManager.hoverContent || undefined };
      });

    console.log('Highlighting smell:', targetSmell, colour, style, smellLines);
    const decoration = this.getDecoration(colour, style);
    editor.setDecorations(decoration, smellLines);
    this.decorations.push(decoration);
  }

  private getDecoration(
    colour: string,
    style: string,
  ): vscode.TextEditorDecorationType {
    switch (style) {
      case 'underline':
        return vscode.window.createTextEditorDecorationType({
          textDecoration: `wavy ${colour} underline 1px`,
        });
      case 'flashlight':
        return vscode.window.createTextEditorDecorationType({
          isWholeLine: true,
          backgroundColor: colour,
        });
      case 'border-arrow':
        return vscode.window.createTextEditorDecorationType({
          borderWidth: '1px 2px 1px 0',
          borderStyle: 'solid',
          borderColor: colour,
          after: {
            contentText: '▶',
            margin: '0 0 0 5px',
            color: colour,
            fontWeight: 'bold',
          },
          overviewRulerColor: colour,
          overviewRulerLane: vscode.OverviewRulerLane.Right,
        });
      default:
        return vscode.window.createTextEditorDecorationType({
          textDecoration: `wavy ${colour} underline 1px`,
        });
    }
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
