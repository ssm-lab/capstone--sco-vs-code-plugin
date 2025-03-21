import * as vscode from 'vscode';
import {
  refactorSelectedSmell,
  refactorAllSmellsOfType,
} from '../commands/refactorSmell';
import { SmellsCacheManager } from '../context/SmellsCacheManager';

export class HoverManager {
  private static instance: HoverManager;
  private smells: Smell[];
  public hoverContent: vscode.MarkdownString;

  static getInstance(
    context: vscode.ExtensionContext,
    smellsCacheManager: SmellsCacheManager,
    smells: Smell[],
  ): HoverManager {
    if (!HoverManager.instance) {
      HoverManager.instance = new HoverManager(context, smellsCacheManager, smells);
    } else {
      HoverManager.instance.updateSmells(smells);
    }
    return HoverManager.instance;
  }

  public constructor(
    private context: vscode.ExtensionContext,
    private smellsCacheManager: SmellsCacheManager,
    smells: Smell[],
  ) {
    this.smells = smells || [];
    this.hoverContent = this.registerHoverProvider() ?? new vscode.MarkdownString();
    this.registerCommands();
  }

  public updateSmells(smells: Smell[]): void {
    this.smells = smells || [];
  }

  // Register hover provider for Python files
  public registerHoverProvider(): void {
    this.context.subscriptions.push(
      vscode.languages.registerHoverProvider(
        { scheme: 'file', language: 'python' },
        {
          provideHover: (document, position, _token) => {
            const hoverContent = this.getHoverContent(document, position);
            return hoverContent ? new vscode.Hover(hoverContent) : null;
          },
        },
      ),
    );
  }

  // hover content for detected smells
  getHoverContent(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.MarkdownString | null {
    const lineNumber = position.line + 1; // convert to 1-based index
    console.log('line number: ' + position.line);
    // filter to find the smells on current line
    const smellsOnLine = this.smells.filter((smell) =>
      smell.occurences.some(
        (occurrence) =>
          occurrence.line === lineNumber ||
          (occurrence.endLine &&
            lineNumber >= occurrence.line &&
            lineNumber <= occurrence.endLine),
      ),
    );

    console.log('smells: ' + smellsOnLine);

    if (smellsOnLine.length === 0) {
      return null;
    }

    const hoverContent = new vscode.MarkdownString();
    hoverContent.isTrusted = true; // Allow command links

    smellsOnLine.forEach((smell) => {
      hoverContent.appendMarkdown(
        `**${smell.symbol}:** ${smell.message}\t\t` +
          `[Refactor](command:extension.refactorThisSmell?${encodeURIComponent(
            JSON.stringify(smell),
          )})\t\t` +
          `---[Refactor all smells of this type...](command:extension.refactorAllSmellsOfType?${encodeURIComponent(
            JSON.stringify(smell),
          )})\n\n`,
      );
      console.log(hoverContent);
    });

    return hoverContent;
  }

  // Register commands for refactor actions
  public registerCommands(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        'extension.refactorThisSmell',
        async (smell: Smell) => {
          await refactorSelectedSmell(this.context, this.smellsCacheManager, smell);
        },
      ),
      // clicking "Refactor All Smells of this Type..."
      vscode.commands.registerCommand(
        'extension.refactorAllSmellsOfType',
        async (smell: Smell) => {
          await refactorAllSmellsOfType(
            this.context,
            this.smellsCacheManager,
            smell.messageId,
          );
        },
      ),
    );
  }
}
