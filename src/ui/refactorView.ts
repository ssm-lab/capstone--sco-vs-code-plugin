import * as vscode from 'vscode';
import path from 'path';
import * as fs from 'fs';

import { envConfig } from '../utils/envConfig';
import { readFileSync } from 'fs';
import { ActiveDiff } from '../types';
import { sidebarState } from '../utils/handleEditorChange';
import { MultiRefactoredData } from '../commands/refactorSmell';

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
        const savedState = this._context.workspaceState.get<RefactoredData>(
          envConfig.CURRENT_REFACTOR_DATA_KEY!
        );

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
          sidebarState.isOpening = true;
          console.log('Switching diff file view.');
          await vscode.commands.executeCommand(
            'vscode.diff',
            vscode.Uri.file(message.original),
            vscode.Uri.file(message.refactored),
            'Refactoring Comparison'
          );
          sidebarState.isOpening = false;
          break;
        case 'accept':
          await this.applyRefactoring();
          await this.closeViews();
          break;
        case 'reject':
          await this.closeViews();
          break;
      }
    });
    console.log('Initialized sidebar view');
  }

  async updateView() {
    console.log('Updating view');
    const refactoredData = this._context.workspaceState.get<RefactoredData>(
      envConfig.CURRENT_REFACTOR_DATA_KEY!
    )!;

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
    const diffView = this._context.workspaceState.get<ActiveDiff>(
      envConfig.ACTIVE_DIFF_KEY!
    )!;

    if (diffView.isOpen) {
      console.log('starting view');
      this._view!.show(true);
      this._view!.webview.postMessage({
        command: 'update',
        data: refactoredData,
        sep: path.sep
      });
    } else {
      console.log('Gonna pause');
      this.pauseView();
    }
  }

  pauseView() {
    console.log('pausing view');
    this._view!.webview.postMessage({ command: 'pause' });
  }

  async clearView() {
    await this._view?.webview.postMessage({ command: 'clear' });
    this._file_map = new Map();

    console.log('View cleared');
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

  private async closeViews() {
    await this.clearView();
    try {
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      await vscode.commands.executeCommand('workbench.view.explorer');

      await this._context.workspaceState.update(
        envConfig.ACTIVE_DIFF_KEY!,
        undefined
      );

      const tempDirs =
        this._context.workspaceState.get<RefactoredData>(
          envConfig.CURRENT_REFACTOR_DATA_KEY!
        )?.tempDir ||
        this._context.workspaceState.get<MultiRefactoredData>(
          envConfig.CURRENT_REFACTOR_DATA_KEY!
        )?.tempDirs;

      if (Array.isArray(tempDirs)) {
        for (const dir in tempDirs) {
          await fs.promises.rm(dir, { recursive: true, force: true });
        }
      } else if (tempDirs) {
        await fs.promises.rm(tempDirs, { recursive: true, force: true });
      }
    } catch (err) {
      console.error('Error closing views', err);
    }

    console.log('Closed views');

    await this._context.workspaceState.update(
      envConfig.CURRENT_REFACTOR_DATA_KEY!,
      undefined
    );
  }

  private async applyRefactoring() {
    try {
      for (const [original, refactored] of this._file_map.entries()) {
        const content = await vscode.workspace.fs.readFile(refactored);
        await vscode.workspace.fs.writeFile(original, content);
        await vscode.workspace.save(original);
        console.log(`Applied refactoring to ${original.fsPath}`);
      }
      vscode.window.showInformationMessage('Refactoring applied successfully!');
    } catch (error) {
      console.error('Error applying refactoring:', error);
    }
  }
}
