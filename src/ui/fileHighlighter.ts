import * as vscode from "vscode";

export class FileHighlighter {
    static highlightSmells(editor: vscode.TextEditor, smells: any[]) {
        

        const yellowUnderline = vscode.window.createTextEditorDecorationType({
            textDecoration: 'underline yellow',
        });
    

        const decorations: vscode.DecorationOptions[] = smells.filter((smell: Smell) => isValidLine(smell.line)).map((smell: any) => {
            const line = smell.line - 1; // convert to zero-based line index for VS editor 
            const range = new vscode.Range(line, 0, line, editor.document.lineAt(line).text.length);

            return { range, hoverMessage: `Smell: ${smell.message}` }; // option to hover over and read smell details 
        });

        editor.setDecorations(yellowUnderline, decorations);
        console.log("Updated smell line highlights");
    }
}

function isValidLine(line: any): boolean {
    return (
        line !== undefined &&
        line !== null &&
        typeof line === 'number' &&
        Number.isFinite(line) &&
        line > 0 &&
        Number.isInteger(line)
    );
}
