import * as vscode from 'vscode';
import { SmellsCacheManager } from '../context/SmellsCacheManager';

/**
 * Displays smell information on hover when hovering over lines in Python files.
 */
export class HoverManager implements vscode.HoverProvider {
  constructor(private smellsCacheManager: SmellsCacheManager) {}

  /**
   * Registers the hover provider for Python files.
   */
  public register(context: vscode.ExtensionContext): void {
    const selector: vscode.DocumentSelector = { language: 'python', scheme: 'file' };
    const disposable = vscode.languages.registerHoverProvider(selector, this);
    context.subscriptions.push(disposable);
  }

  /**
   * Provides hover content with stacked smell info.
   */
  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.Hover> {
    const filePath = document.uri.fsPath;

    if (!filePath.endsWith('.py')) return;

    const smells = this.smellsCacheManager.getCachedSmells(filePath);
    if (!smells || smells.length === 0) return;

    const lineNumber = position.line + 1;

    const smellsAtLine = smells.filter((smell) =>
      smell.occurences.some((occ) => occ.line === lineNumber),
    );

    if (smellsAtLine.length === 0) return;

    const escape = (text: string): string => {
      return text.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&');
    };

    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    markdown.supportHtml = true;
    markdown.supportThemeIcons = true;

    smellsAtLine.forEach((smell) => {
      const messageLine = `${escape(smell.message)} (**${escape(smell.messageId)}**)`;
      const divider = '\n\n---\n\n';
      const refactorSmellCmd = `command:ecooptimizer.refactorSmell?${encodeURIComponent(JSON.stringify(smell))} "Fix this specific smell"`;
      const refactorTypeCmd = `command:ecooptimizer.refactorAllSmellsOfType?${encodeURIComponent(
        JSON.stringify({
          fullPath: filePath,
          smellType: smell.messageId,
        }),
      )} "Fix all similar smells"`;

      markdown.appendMarkdown(messageLine);
      markdown.appendMarkdown(divider);
      markdown.appendMarkdown(`[$(tools) Refactor Smell](${refactorSmellCmd}) | `);
      markdown.appendMarkdown(
        `[$(tools) Refactor All of This Type](${refactorTypeCmd})`,
      );
    });

    return new vscode.Hover(markdown);
  }
}
