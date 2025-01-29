import * as vscode from 'vscode';

export class ContextManager {
  public context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  // Global state example
  public getGlobalData(
    key: string,
    defaultVal: any = undefined
  ): any | undefined {
    return this.context.globalState.get<any>(key, defaultVal);
  }

  public setGlobalData(key: string, value: any): Thenable<void> {
    return this.context.globalState.update(key, value);
  }

  // Workspace state example
  public getWorkspaceData(
    key: string,
    defaultVal: any = undefined
  ): any | undefined {
    return this.context.workspaceState.get<any>(key, defaultVal);
  }

  public setWorkspaceData(key: string, value: any): Thenable<void> {
    return this.context.workspaceState.update(key, value);
  }
}
