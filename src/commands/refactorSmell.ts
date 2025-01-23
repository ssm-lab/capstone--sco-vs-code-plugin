import * as vscode from "vscode";
import { RefactorManager } from "../ui/refactorManager";
import { getEditorAndFilePath } from "../utils/editorUtils";
import { FileHighlighter } from "../ui/fileHighlighter";
import { Smell } from "../types";
import { fetchSmells, refactorSmell } from "../api/backend";


async function refactorLine(smell: Smell, filePath: string, context: vscode.ExtensionContext){
    try {
        const refactorResult = await refactorSmell(filePath, smell);
        return refactorResult;
    } catch (error) {
        console.error("Error refactoring smell:", error);
        vscode.window.showErrorMessage(`Eco: Error refactoring smell: ${error}`);
        return;
    }
}

export async function refactorSelectedSmell(context: vscode.ExtensionContext) {
    const {editor, filePath} = getEditorAndFilePath();

    if (!editor) {
        vscode.window.showErrorMessage("Eco: Unable to proceed as no active editor found.");
        console.log("No active editor found to refactor smell. Returning back.");
        return;
    }
    if (!filePath) {
        vscode.window.showErrorMessage("Eco: Unable to proceed as active editor does not have a valid file path.");
        console.log("No valid file path found to refactor smell. Returning back.");
        return;
    }

    // only account for one selection to be refactored for now
    const selectedLine = editor.selection.start.line + 1; // update to VS code editor indexing

    const smellsData = await fetchSmells(filePath);
    if (!smellsData || smellsData.length === 0) {
        vscode.window.showErrorMessage("Eco: No smells detected in the file for refactoring.");
        console.log("No smells found in the file for refactoring.");
        return;
    }

    const matchingSmells = smellsData.filter((smell: Smell) => {
        return selectedLine === smell.line; 
    });

    if (matchingSmells.length === 0) {
        vscode.window.showInformationMessage("Eco: Selected line(s) does not include a refactorable code pattern. Please switch to a line with highlighted code smell.");
        return;
    }

    vscode.window.showInformationMessage('Eco: Refactoring smell on selected line.');
    console.log("Detecting smells in detectSmells on selected line");

    //refactor the first found smell
    //TODO UI that allows users to choose the smell to refactor 
    const refactorResult = await refactorLine(matchingSmells[0], filePath, context);
    if (!refactorResult) {
        vscode.window.showErrorMessage("Eco: Refactoring failed. See console for details.");
        return;
    }
    const refactoredCode = refactorResult.refactoredCode;
    const energyDifference = refactorResult.energyDifference;
    const updatedSmells = refactorResult.updatedSmells;

    await RefactorManager.previewRefactor(editor, refactoredCode);
    vscode.window.showInformationMessage(
        `Eco: Refactoring completed. Energy difference: ${energyDifference.toFixed(4)}`
    );
    
    if (updatedSmells) {
        FileHighlighter.highlightSmells(editor, updatedSmells);
    } else {
        vscode.window.showWarningMessage("Eco: No updated smells detected after refactoring.");
    }
}
