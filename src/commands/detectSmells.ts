import * as vscode from "vscode";
import { FileHighlighter } from "../ui/fileHighlighter";
import { getEditorAndFilePath } from "../utils/editorUtils";
import * as fs from "fs"; 
import { Smell } from "../types";
import { fetchSmells } from "../api/backend";

export  async function getSmells(filePath: string, context: vscode.ExtensionContext) {
    try {
        const smellsList : Smell[] = await fetchSmells(filePath);
        if (smellsList.length === 0) {
            throw new Error("Detected smells data is invalid or empty.");
        }

        return smellsList;
    } catch(error) {
        console.error("Error detecting smells:", error);
        vscode.window.showErrorMessage(`Eco: Error detecting smells: ${error}`);
        return;
    }
}

export async function detectSmells(context: vscode.ExtensionContext){
    const {editor, filePath} = getEditorAndFilePath();

    if (!editor) {
        vscode.window.showErrorMessage("Eco: Unable to proceed as no active editor found.");
        console.error("No active editor found to detect smells. Returning back.");
        return;
    }
    if (!filePath) {
        vscode.window.showErrorMessage("Eco: Unable to proceed as active editor does not have a valid file path.");
        console.error("No valid file path found to detect smells. Returning back.");
        return;
    }

    vscode.window.showInformationMessage("Eco: Detecting smells...");
    console.log("Detecting smells in detectSmells");
    
    const smellsData = await getSmells(filePath, context);

    if (!smellsData){
        console.log("No valid smells data found. Returning.");
        vscode.window.showErrorMessage("Eco: No smells are present in current file.");
        return;
    }

    console.log("Detected smells data: ", smellsData);
    vscode.window.showInformationMessage(`Eco: Detected ${smellsData.length} smells in the file.`);

    FileHighlighter.highlightSmells(editor, smellsData);
    vscode.window.showInformationMessage("Eco: Detected code smells have been highlighted.");
}
