import * as vscode from 'vscode';

/**
 * Manages persistent data storage within VS Code's workspace state.
 * This includes global and workspace-specific data.
 */
export class ContextManager {
  public context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  // ============================
  // Global State (Persists across VS Code sessions)
  // ============================

  /**
   * Retrieves globally stored data that persists across VS Code sessions.
   *
   * @param key - The key associated with the stored value.
   * @param defaultVal - The default value to return if the key does not exist.
   * @returns The stored data or the default value.
   */
  public getGlobalData<T = any>(
    key: string,
    defaultVal: any = undefined,
  ): T | undefined {
    return this.context.globalState.get<T>(key, defaultVal);
  }

  /**
   * Updates global data that persists across VS Code sessions.
   *
   * @param key - The key for storing the value.
   * @param value - The value to store.
   */
  public setGlobalData(key: string, value: any): Thenable<void> {
    return this.context.globalState.update(key, value);
  }

  // ============================
  // Workspace State (Resets per workspace)
  // ============================

  /**
   * Retrieves workspace-specific data that resets when the user changes workspaces.
   *
   * @param key - The key associated with the stored value.
   * @param defaultVal - The default value to return if the key does not exist.
   * @returns The stored data or the default value.
   */
  public getWorkspaceData<T = any>(
    key: string,
    defaultVal: any = undefined,
  ): T | undefined {
    return this.context.workspaceState.get<T>(key, defaultVal);
  }

  /**
   * Updates workspace-specific data.
   *
   * @param key - The key for storing the value.
   * @param value - The value to store.
   */
  public setWorkspaceData(key: string, value: any): Thenable<void> {
    return this.context.workspaceState.update(key, value);
  }
}
