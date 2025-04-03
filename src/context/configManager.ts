import * as vscode from 'vscode';

export class ConfigManager {
  private static readonly CONFIG_SECTION = 'ecooptimizer.detection';

  /**
   * Get a specific configuration value.
   * @param key The key of the configuration property.
   * @param _default The default value to return if the configuration property is not found.
   * @returns The value of the configuration property.
   */
  public static get<T>(key: string, _default: any = undefined): T {
    const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
    return config.get<T>(key, _default);
  }

  /**
   * Update a specific configuration value.
   * @param key The key of the configuration property.
   * @param value The new value to set.
   * @param global Whether to update the global configuration or workspace configuration.
   */
  public static async update<T>(
    key: string,
    value: T,
    global: boolean = false,
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
    await config.update(key, value, global);
  }

  /**
   * Get all configuration values under the ecooptimizer.detection section.
   * @returns The entire configuration object.
   */
  public static getAll(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(this.CONFIG_SECTION);
  }
}
