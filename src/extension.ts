import * as vscode from "vscode";
import { detectSmells } from "./commands/detectSmells";
import { refactorSmell } from "./commands/refactorSmell";
import { getEditor } from "./utils/editorUtils";

interface Smell {
    line: number; // Known attribute
    [key: string]: any; // Index signature for unknown properties
}

export function activate(context: vscode.ExtensionContext) {
    console.log("Refactor Plugin activated");

    // Register Detect Smells Command
    let detectSmellsCmd = vscode.commands.registerCommand("ecooptimizer-vs-code-plugin.detectSmells", async () => {
            console.log("Command detectSmells triggered");
            detectSmells(context);
        }
    );
    context.subscriptions.push(detectSmellsCmd);

    // Register Refactor Smell Command
    let refactorSmellCmd = vscode.commands.registerCommand("ecooptimizer-vs-code-plugin.refactorSmell", () => {
        console.log("Command refactorSmells triggered");
        vscode.window.showInformationMessage("Eco: Detecting smells...");
        refactorSmell(context);
    });
    context.subscriptions.push(refactorSmellCmd);
}

export function deactivate() {
    console.log("Refactor Plugin deactivated");
}
