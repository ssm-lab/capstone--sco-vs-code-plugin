import * as vscode from 'vscode';
import { SmellsCacheManager } from '../context/SmellsCacheManager';
import { getDescriptionByMessageId, getNameByMessageId } from '../utils/smellsData';

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
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.Hover> {
    const filePath = document.uri.fsPath;
    const smells = this.smellsCacheManager.getCachedSmells(filePath);
    if (!smells || smells.length === 0) return;

    const lineNumber = position.line + 1;

    const smellsAtLine = smells.filter((smell) =>
      smell.occurences.some((occ) => occ.line === lineNumber),
    );

    if (smellsAtLine.length === 0) return;

    const wrap = (text: string, width = 50): string =>
      text.replace(new RegExp(`(.{1,${width}})(\\s+|$)`, 'g'), '$1\n').trim();

    const hoverSections = smellsAtLine.map((smell) => {
      const name =
        getNameByMessageId(smell.messageId) ?? `Unknown Smell (${smell.messageId})`;
      const description =
        getDescriptionByMessageId(smell.messageId) ?? 'No description available.';
      const message = smell.message ?? 'No message provided.';

      return [
        `🍂 **${name}**`,
        `- \`${wrap(message)}\``,
        `- _${wrap(description)}_`,
      ].join('\n');
    });

    const markdown = new vscode.MarkdownString(hoverSections.join('\n\n---\n\n'));
    markdown.isTrusted = true;

    return new vscode.Hover(markdown);
  }
}
