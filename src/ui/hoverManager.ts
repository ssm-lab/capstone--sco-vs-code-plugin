import * as vscode from "vscode";
import { Smell } from "../types";
import { refactorSelectedSmell } from "../commands/refactorSmell";
import { ContextManager } from "../context/contextManager";

export class HoverManager {
    private static instance: HoverManager;
    private smells: Smell[];
    public hoverContent: vscode.MarkdownString;
    private vscodeContext: vscode.ExtensionContext;

    static getInstance(contextManager: ContextManager, smells: Smell[]): HoverManager {
        if (!HoverManager.instance) {
            HoverManager.instance = new HoverManager(contextManager, smells);
        } else {
            HoverManager.instance.updateSmells(smells);
        }
        return HoverManager.instance;
    }

    private constructor(private contextManager: ContextManager, smells: Smell[]) {
        this.smells = smells || [];
        this.vscodeContext = contextManager.context;
        this.hoverContent = this.registerHoverProvider() ?? new vscode.MarkdownString();
        this.registerCommands();
    }

    private updateSmells(smells: Smell[]): void {
        this.smells = smells || [];
    }

    // Register hover provider for Python files
    private registerHoverProvider(): void {
        this.vscodeContext.subscriptions.push(
            vscode.languages.registerHoverProvider(
                { scheme: "file", language: "python" },
                {
                    provideHover: (document, position, token) => {
                        const hoverContent = this.getHoverContent(document, position);
                        return hoverContent ? new vscode.Hover(hoverContent) : null;
                    },
                }
            )
        );
    }

    // hover content for detected smells
    getHoverContent(document: vscode.TextDocument, position: vscode.Position): vscode.MarkdownString | null {
        
        const lineNumber = position.line + 1; // convert to 1-based index

        // filter to find the smells on current line
        const smellsOnLine = this.smells.filter((smell) => 
            smell.occurences.some((occurrence) => 
                occurrence.line === lineNumber || 
                (occurrence.endLine && lineNumber >= occurrence.line && lineNumber <= occurrence.endLine)
            )
        );

        if (smellsOnLine.length === 0) {
            return null;
        }

        const hoverContent = new vscode.MarkdownString();
        hoverContent.isTrusted = true; // Allow command links

        smellsOnLine.forEach((smell) => {
            hoverContent.appendMarkdown(
                `**${smell.symbol}:** ${smell.message}\t\t` + 
                `[Refactor](command:extension.refactorThisSmell?${encodeURIComponent(
                    JSON.stringify(smell)
                )})\n\n`
            );
        });

        hoverContent.appendMarkdown(
            `---\n\n[Refactor all smells of this type...](command:extension.refactorSmellTypeDropdown?${encodeURIComponent(
                JSON.stringify(smellsOnLine)
            )})\n\n`
        );

        return hoverContent;
    }

    // Register commands for refactor actions
    private registerCommands(): void {
        this.vscodeContext.subscriptions.push(
            vscode.commands.registerCommand(
                "extension.refactorThisSmell",
                async (smell: Smell) => {
                    const contextManager = new ContextManager(this.vscodeContext);
                    await refactorSelectedSmell(contextManager, this.vscodeContext, smell.messageId);
                }
            ),
            // clicking "Refactor All Smells of this Type..."
            vscode.commands.registerCommand(
                "extension.refactorSmellTypeDropdown",
                async (smellsOnLine: Smell[]) => {
                    vscode.window.showInformationMessage(
                        `Eco: clicked refactorSmellTypeDropdown`
                    );
                    const hoverContent = new vscode.MarkdownString();
                    hoverContent.isTrusted = true;

                    smellsOnLine.forEach((smell) => {
                        vscode.window.showInformationMessage(
                            `Eco: adding smell type ${smell.type}`
                        );
                        hoverContent.appendMarkdown(
                            `**${smell.type}**\n` +
                            `[Refactor all ${smell.type} smells](command:extension.refactorSmellAcrossRepo?${encodeURIComponent(
                                JSON.stringify(smell.type)
                            )})\n\n`
                        );
                    });

                    vscode.window.showInformationMessage(
                        `Eco: Smell type dropdown made ${hoverContent}`
                    );

                    // Show hover content
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        const position = editor.selection.active;
                        vscode.languages.registerHoverProvider('*', {
                            provideHover() {
                                vscode.window.showInformationMessage(
                                    `Eco: Smell type dropdown made`
                                );
                                return new vscode.Hover(hoverContent);
                            }
                        });
                    }
                }
            ),
            // clicking the specific smell from dropdown
            vscode.commands.registerCommand(
                "extension.refactorSmellAcrossRepo",
                (smellType: string) => {
                    vscode.window.showInformationMessage(
                        `Refactoring all occurrences of: ${smellType}`
                    );
                    const refactorSmells = require("../commands/refactorSmell");
                    refactorSmells.refactorAllOfType(smellType);
                }
            )
        );
    }
}
