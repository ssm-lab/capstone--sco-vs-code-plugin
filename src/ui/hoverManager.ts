import * as vscode from 'vscode';
import { SmellsCacheManager } from '../context/SmellsCacheManager';

/**
 * Provides hover information for detected code smells in Python files.
 * Shows smell details and quick actions when hovering over affected lines.
 */
export class HoverManager implements vscode.HoverProvider {
  constructor(private smellsCacheManager: SmellsCacheManager) {}

  /**
   * Registers the hover provider with VS Code
   * @param context The extension context for managing disposables
   */
  public register(context: vscode.ExtensionContext): void {
    const selector: vscode.DocumentSelector = {
      language: 'python',
      scheme: 'file', // Only show for local files, not untitled documents
    };
    const disposable = vscode.languages.registerHoverProvider(selector, this);
    context.subscriptions.push(disposable);
  }

  /**
   * Generates hover content when hovering over lines with detected smells
   * @param document The active text document
   * @param position The cursor position where hover was triggered
   * @returns Hover content or undefined if no smells found
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

    // Convert VS Code position to 1-based line number
    const lineNumber = position.line + 1;

    // Find smells that occur on this line
    const smellsAtLine = smells.filter((smell) =>
      smell.occurences.some((occ) => occ.line === lineNumber),
    );

    if (smellsAtLine.length === 0) return;

    // Helper to escape markdown special characters
    const escape = (text: string): string => {
      return text.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&');
    };

    // Build markdown content with smell info and actions
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true; // Allow command URIs
    markdown.supportHtml = true;
    markdown.supportThemeIcons = true;

    // Add each smell's info and actions
    smellsAtLine.forEach((smell) => {
      // Basic smell info
      const messageLine = `${escape(smell.message)} (**${escape(smell.messageId)}**)`;
      const divider = '\n\n---\n\n'; // Visual separator

      // Command URIs for quick actions
      const refactorSmellCmd = `command:ecooptimizer.refactorSmell?${encodeURIComponent(JSON.stringify(smell))} "Fix this specific smell"`;
      const refactorTypeCmd = `command:ecooptimizer.refactorAllSmellsOfType?${encodeURIComponent(
        JSON.stringify({
          fullPath: filePath,
          smellType: smell.messageId,
        }),
      )} "Fix all similar smells"`;

      // Build the hover content
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
