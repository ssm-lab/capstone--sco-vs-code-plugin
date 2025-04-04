import * as vscode from 'vscode';
import {
  FilterSmellConfig,
  getFilterSmells,
  loadSmells,
  saveSmells,
} from '../utils/smellsData';
import { MetricsViewProvider } from './MetricsViewProvider';
import { SmellsCacheManager } from '../context/SmellsCacheManager';
import { SmellsViewProvider } from './SmellsViewProvider';

/**
 * Provides a tree view for managing and filtering code smells in the VS Code extension.
 * Handles smell configuration, option editing, and maintains consistency with cached results.
 */
export class FilterViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  // Event emitter for tree view updates
  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined | void
  > = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private treeView?: vscode.TreeView<vscode.TreeItem>;
  private smells: Record<string, FilterSmellConfig> = {};

  constructor(
    private context: vscode.ExtensionContext,
    private metricsViewProvider: MetricsViewProvider,
    private smellsCacheManager: SmellsCacheManager,
    private smellsViewProvider: SmellsViewProvider,
  ) {
    this.smells = getFilterSmells();
  }

  /**
   * Sets up the tree view and handles checkbox state changes
   * @param treeView The VS Code tree view instance to manage
   */
  setTreeView(treeView: vscode.TreeView<vscode.TreeItem>): void {
    this.treeView = treeView;

    this.treeView.onDidChangeCheckboxState(async (event) => {
      for (const [item] of event.items) {
        if (item instanceof SmellItem) {
          const confirmed = await this.confirmFilterChange();
          if (confirmed) {
            await this.toggleSmell(item.key);
          } else {
            // Refresh view if change was cancelled
            this._onDidChangeTreeData.fire();
          }
        }
      }
    });
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Gets children items for the tree view
   * @param element Parent element or undefined for root items
   * @returns Promise resolving to array of tree items
   */
  getChildren(element?: SmellItem): Thenable<vscode.TreeItem[]> {
    if (!element) {
      // Root level items - all available smells
      return Promise.resolve(
        Object.keys(this.smells)
          .sort((a, b) => this.smells[a].name.localeCompare(this.smells[b].name))
          .map((smellKey) => {
            const smell = this.smells[smellKey];
            return new SmellItem(
              smellKey,
              smell.name,
              smell.enabled,
              smell.analyzer_options &&
              Object.keys(smell.analyzer_options).length > 0
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None,
            );
          }),
      );
    }

    // Child items - smell configuration options
    const options = this.smells[element.key]?.analyzer_options;
    return options
      ? Promise.resolve(
          Object.entries(options).map(
            ([optionKey, optionData]) =>
              new SmellOptionItem(
                optionKey,
                optionData.label,
                optionData.value,
                optionData.description,
                element.key,
              ),
          ),
        )
      : Promise.resolve([]);
  }

  /**
   * Toggles a smell's enabled state
   * @param smellKey The key of the smell to toggle
   */
  async toggleSmell(smellKey: string): Promise<void> {
    if (this.smells[smellKey]) {
      this.smells[smellKey].enabled = !this.smells[smellKey].enabled;
      saveSmells(this.smells);
      await this.invalidateCachedSmellsForAffectedFiles();
      this._onDidChangeTreeData.fire();
    }
  }

  /**
   * Updates a smell analyzer option value
   * @param smellKey The smell containing the option
   * @param optionKey The option to update
   * @param newValue The new value for the option
   */
  async updateOption(
    smellKey: string,
    optionKey: string,
    newValue: number | string,
  ): Promise<void> {
    const confirmed = await this.confirmFilterChange();
    if (!confirmed) return;

    if (this.smells[smellKey]?.analyzer_options?.[optionKey]) {
      this.smells[smellKey].analyzer_options[optionKey].value = newValue;
      saveSmells(this.smells);
      await this.invalidateCachedSmellsForAffectedFiles();
      this._onDidChangeTreeData.fire();
    } else {
      vscode.window.showErrorMessage(
        `Error: No analyzer option found for ${optionKey}`,
      );
    }
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Enables or disables all smells at once
   * @param enabled Whether to enable or disable all smells
   */
  async setAllSmellsEnabled(enabled: boolean): Promise<void> {
    const confirmed = await this.confirmFilterChange();
    if (!confirmed) return;

    Object.keys(this.smells).forEach((key) => {
      this.smells[key].enabled = enabled;
    });
    saveSmells(this.smells);
    await this.invalidateCachedSmellsForAffectedFiles();
    this._onDidChangeTreeData.fire();
  }

  /**
   * Resets all smell configurations to their default values
   */
  async resetToDefaults(): Promise<void> {
    const confirmed = await this.confirmFilterChange();
    if (!confirmed) return;

    loadSmells('default');
    this.smells = getFilterSmells();
    saveSmells(this.smells);

    await this.invalidateCachedSmellsForAffectedFiles();
    this._onDidChangeTreeData.fire();
  }

  /**
   * Invalidates cached smells for all files when filters change
   */
  async invalidateCachedSmellsForAffectedFiles(): Promise<void> {
    const cachedFilePaths = this.smellsCacheManager.getAllFilePaths();

    for (const filePath of cachedFilePaths) {
      this.smellsCacheManager.clearCachedSmellsForFile(filePath);
      this.smellsViewProvider.setStatus(filePath, 'outdated');
    }

    this.metricsViewProvider.refresh();
    this.smellsViewProvider.refresh();
  }

  /**
   * Shows confirmation dialog for filter changes that invalidate cache
   * @returns Promise resolving to whether change should proceed
   */
  private async confirmFilterChange(): Promise<boolean> {
    const suppressWarning = this.context.workspaceState.get<boolean>(
      'ecooptimizer.suppressFilterWarning',
      false,
    );

    if (suppressWarning) {
      return true;
    }

    const result = await vscode.window.showWarningMessage(
      'Changing smell filters will invalidate existing analysis results. Do you want to continue?',
      { modal: true },
      'Yes',
      "Don't Remind Me Again",
    );

    if (result === "Don't Remind Me Again") {
      await this.context.workspaceState.update(
        'ecooptimizer.suppressFilterWarning',
        true,
      );
      return true;
    }

    return result === 'Yes';
  }
}

/**
 * Tree item representing a single smell in the filter view
 */
class SmellItem extends vscode.TreeItem {
  constructor(
    public readonly key: string,
    public readonly name: string,
    public enabled: boolean,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(name, collapsibleState);
    this.contextValue = 'smellItem';
    this.checkboxState = enabled
      ? vscode.TreeItemCheckboxState.Checked
      : vscode.TreeItemCheckboxState.Unchecked;
  }
}

/**
 * Tree item representing a configurable option for a smell
 */
class SmellOptionItem extends vscode.TreeItem {
  constructor(
    public readonly optionKey: string,
    public readonly label: string,
    public value: number | string,
    public readonly description: string,
    public readonly smellKey: string,
  ) {
    super('placeholder', vscode.TreeItemCollapsibleState.None);

    this.contextValue = 'smellOption';
    this.label = `${label}: ${value}`;
    this.tooltip = description;
    this.description = '';
    this.command = {
      command: 'ecooptimizer.editSmellFilterOption',
      title: 'Edit Option',
      arguments: [this],
    };
  }
}
