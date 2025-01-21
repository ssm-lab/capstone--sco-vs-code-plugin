import * as vscode from "vscode";


export class RefactorManager {
    static async previewRefactor(editor: vscode.TextEditor, refactoredCode: string) {
        
        try {
            // Create a new untitled document for preview
            const previewDocument = await vscode.workspace.openTextDocument({
                content: refactoredCode,
                language: "python", // Adjust this to the language of your file
            });

            // Show the document in a new editor column
            await vscode.window.showTextDocument(previewDocument, vscode.ViewColumn.Beside);
        } catch (error) {
            vscode.window.showErrorMessage(`Eco: Error showing refactor preview: ${error}`);
        }
    }
}
