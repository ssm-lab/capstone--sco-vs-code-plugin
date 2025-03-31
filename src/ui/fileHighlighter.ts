import * as vscode from 'vscode';
import { SmellsCacheManager } from '../context/SmellsCacheManager';
import { ConfigManager } from '../context/configManager';
import { getEnabledSmells } from '../utils/smellsData';

/**
 * The `FileHighlighter` class is responsible for managing and applying visual highlights
 * to code smells in the VS Code editor. It uses cached smell data to determine which
 * lines to highlight and applies decorations to the editor accordingly.
 */
export class FileHighlighter {
  private static instance: FileHighlighter | undefined;
  private decorations: vscode.TextEditorDecorationType[] = [];

  private constructor(private smellsCacheManager: SmellsCacheManager) {
    this.smellsCacheManager.onSmellsUpdated((target) => {
      if (target === 'all') {
        this.updateHighlightsForVisibleEditors();
      } else {
        this.updateHighlightsForFile(target);
      }
    });
  }

  /**
   * Retrieves the singleton instance of the `FileHighlighter` class.
   * If the instance does not exist, it is created.
   *
   * @param smellsCacheManager - The manager responsible for caching and providing smell data.
   * @returns The singleton instance of `FileHighlighter`.
   */
  public static getInstance(
    smellsCacheManager: SmellsCacheManager,
  ): FileHighlighter {
    if (!FileHighlighter.instance) {
      FileHighlighter.instance = new FileHighlighter(smellsCacheManager);
    }
    return FileHighlighter.instance;
  }

  /**
   * Updates highlights for a specific file if it is currently open in a visible editor.
   *
   * @param filePath - The file path of the target file to update highlights for.
   */
  private updateHighlightsForFile(filePath: string): void {
    if (!filePath.endsWith('.py')) {
      return;
    }

    const editor = vscode.window.visibleTextEditors.find(
      (e) => e.document.uri.fsPath === filePath,
    );
    if (editor) {
      this.highlightSmells(editor);
    }
  }

  /**
   * Updates highlights for all currently visible editors.
   */
  public updateHighlightsForVisibleEditors(): void {
    vscode.window.visibleTextEditors.forEach((editor) => {
      if (!editor.document.fileName.endsWith('.py')) {
        return;
      }
      this.highlightSmells(editor);
    });
  }

  /**
   * Resets all active highlights by disposing of all decorations.
   */
  public resetHighlights(): void {
    this.decorations.forEach((decoration) => decoration.dispose());
    this.decorations = [];
  }

  /**
   * Highlights code smells in the given editor based on cached smell data.
   * Resets existing highlights before applying new ones.
   *
   * @param editor - The text editor to apply highlights to.
   */
  public highlightSmells(editor: vscode.TextEditor): void {
    this.resetHighlights();

    const smells = this.smellsCacheManager.getCachedSmells(
      editor.document.uri.fsPath,
    );

    if (!smells) {
      return;
    }

    const smellColours = ConfigManager.get<{
      [key: string]: string;
    }>('smellsColours', {});

    const useSingleColour = ConfigManager.get<boolean>('useSingleColour', false);
    const singleHighlightColour = ConfigManager.get<string>(
      'singleHighlightColour',
      'rgba(255, 204, 0, 0.5)',
    );
    const highlightStyle = ConfigManager.get<string>('highlightStyle', 'underline');

    const activeSmells = new Set<string>(smells.map((smell) => smell.symbol));

    const enabledSmells = getEnabledSmells();

    activeSmells.forEach((smellType) => {
      const smellColour = smellColours[smellType];

      if (enabledSmells[smellType]) {
        const colour = useSingleColour ? singleHighlightColour : smellColour;

        this.highlightSmell(editor, smells, smellType, colour, highlightStyle);
      }
    });
  }

  /**
   * Highlights a specific type of smell in the given editor.
   * Filters smell occurrences to ensure they are valid and match the target smell type.
   *
   * @param editor - The text editor to apply highlights to.
   * @param smells - The list of all smells for the file.
   * @param targetSmell - The specific smell type to highlight.
   * @param colour - The colour to use for the highlight.
   * @param style - The style of the highlight (e.g., underline, flashlight, border-arrow).
   */
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
          isValidLine(occurrence.line, editor.document.lineCount),
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
        return { range };
      });

    const decoration = this.getDecoration(colour, style);

    editor.setDecorations(decoration, smellLines);
    this.decorations.push(decoration);
  }

  /**
   * Creates a text editor decoration type based on the given colour and style.
   *
   * @param colour - The colour to use for the decoration.
   * @param style - The style of the decoration (e.g., underline, flashlight, border-arrow).
   * @returns A `vscode.TextEditorDecorationType` object representing the decoration.
   */
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

function isValidLine(line: any, lineCount: number): boolean {
  const isValid =
    line !== undefined &&
    line !== null &&
    typeof line === 'number' &&
    Number.isFinite(line) &&
    line > 0 &&
    Number.isInteger(line) &&
    line <= lineCount;

  return isValid;
}
