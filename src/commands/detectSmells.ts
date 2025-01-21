import * as vscode from "vscode";
import { BackendCommunicator } from "../backendCommunicator";
import { FileHighlighter } from "../ui/fileHighlighter";
import { getEditorAndFilePath } from "../utils/editorUtils";



export  async function getSmells(filePath: string, context: vscode.ExtensionContext) {
    try {
        const backend = new BackendCommunicator();
        const output = await backend.run("detect", [filePath], context);
        console.log("output is", output);
        const smellsResult = JSON.parse(output);
     
        if (!smellsResult || !smellsResult.smells_data) {
            throw new Error("Detected smells data not found.");
        }
        
        return smellsResult;
    } catch(error) {
        console.error("Error detecting smells:", error);
        vscode.window.showErrorMessage(`Eco: Error detecting smells: ${error}`);
        return null;
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

    if (smellsData && smellsData.length === 0){
        vscode.window.showErrorMessage("Eco: No smells are present in current file.");
        console.log("No smells detected in current file. Returning back.");
        return null;
    }

    console.log("Detected smells data: ", smellsData);

    vscode.window.showInformationMessage(`Eco: Detected ${smellsData.length} smells in the file.`);

    FileHighlighter.highlightSmells(editor, smellsData);
    vscode.window.showInformationMessage("Eco: Detected code smells have been highlighted.");
}
