import * as vscode from 'vscode';
import path from 'path';
import { readFileSync } from 'fs';
import { ActiveDiff } from '../types';
import { promises as fs } from 'fs';

export class RefactorSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'extension.refactorSidebar';
  private _view?: vscode.WebviewView;
  private _file_map: Map<vscode.Uri, vscode.Uri> = new Map();

  constructor(private readonly _context: vscode.ExtensionContext) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    const webview = webviewView.webview;

    webview.options = {
      enableScripts: true
    };

    webview.html = this._getHtml(webview);

    webviewView.onDidChangeVisibility(async () => {
      console.log('Webview is visible');
      if (webviewView.visible) {
        // Use acquireVsCodeApi to get the webview state
        const savedState =
          this._context.workspaceState.get<RefactoredData>('refactorData');

        if (savedState) {
          this.updateView();
          return;
        }
      }
    });

    webviewView.onDidDispose(() => {
      console.log('Webview Disposed');
    });

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'selectFile':
          vscode.commands.executeCommand(
            'vscode.diff',
            vscode.Uri.file(message.original),
            vscode.Uri.file(message.refactored),
            'Refactoring Comparison'
          );
          break;
        case 'accept':
          await this.applyRefactoring();
          this.closeViews();
          break;
        case 'reject':
          this.closeViews();
          break;
      }
    });
    console.log('Initialized sidebar view');
  }

  async updateView() {
    console.log('Updating view');
    const refactoredData =
      this._context.workspaceState.get<RefactoredData>('refactorData')!;

    this._file_map.set(
      vscode.Uri.file(refactoredData.targetFile.original),
      vscode.Uri.file(refactoredData.targetFile.refactored)
    );

    refactoredData.affectedFiles.forEach(({ original, refactored }) => {
      this._file_map!.set(vscode.Uri.file(original), vscode.Uri.file(refactored));
    });

    if (this._view) {
      this.openView(refactoredData);
    }
  }

  private async openView(refactoredData: RefactoredData) {
    const diffView = this._context.workspaceState.get<ActiveDiff>('activeDiff')!;

    if (diffView.isOpen) {
      console.log('starting view');
      this._view!.show(true);
      this._view!.webview.postMessage({ command: 'update', data: refactoredData });
    } else {
      console.log('Gonna pause');
      this.pauseView();
    }
  }

  pauseView() {
    console.log('pausing view');
    this._view!.webview.postMessage({ command: 'pause' });
  }

  clearView() {
    this._view?.webview.postMessage({ command: 'clear' });
    this._file_map = new Map();
  }

  private _getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this._context.extensionPath, 'media', 'script.js'))
    );
    const customCssUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this._context.extensionPath, 'media', 'style.css'))
    );
    const vscodeCssUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this._context.extensionPath, 'media', 'vscode.css'))
    );
    const htmlPath = path.join(this._context.extensionPath, 'media', 'webview.html');
    let htmlContent = readFileSync(htmlPath, 'utf8');

    // Inject the script URI dynamically
    htmlContent = htmlContent.replace('${vscodeCssUri}', vscodeCssUri.toString());
    htmlContent = htmlContent.replace('${customCssUri}', customCssUri.toString());
    htmlContent = htmlContent.replace('${scriptUri}', scriptUri.toString());

    return htmlContent;
  }

  private closeViews() {
    this._file_map = new Map();
    vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    vscode.commands.executeCommand('workbench.view.explorer');

    const tempDir =
      this._context.workspaceState.get<RefactoredData>('refactorData')?.tempDir!;

    fs.rm(tempDir, { recursive: true });

    this._context.workspaceState.update('activeDiff', undefined);
    this._context.workspaceState.update('refactorData', undefined);
  }

  private async applyRefactoring() {
    this._file_map!.forEach(async (refactored, original) => {
      vscode.window.showInformationMessage('Applying Eco changes...');
      console.log(`refactored: ${refactored}\noriginal: ${original}`);
      const modifiedContent = await vscode.workspace.fs.readFile(refactored);

      await vscode.workspace.fs.writeFile(original, modifiedContent);
    });
    vscode.window.showInformationMessage('Refactoring applied successfully!');
  }
}
