import * as vscode from 'vscode';
import { FilterSmellConfig, getFilterSmells, saveSmells } from '../utils/smellsData';
import { SmellsCacheManager } from '../context/SmellsCacheManager';
import { SmellsViewProvider } from './SmellsViewProvider';
import { MetricsViewProvider } from './MetricsViewProvider';

/**
 * Provides a tree view for filtering code smells within the VS Code extension.
 */
export class FilterViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined | void
  > = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private treeView?: vscode.TreeView<vscode.TreeItem>;
  private smells: Record<string, FilterSmellConfig> = {};

  constructor(
    private context: vscode.ExtensionContext,
    private cacheManager: SmellsCacheManager,
    private smellsViewProvider: SmellsViewProvider,
    private metricsViewProvider: MetricsViewProvider,
  ) {
    this.smells = getFilterSmells();
  }

  /**
   * Associates a TreeView instance with the provider and listens for checkbox state changes.
   * @param treeView - The TreeView instance.
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
            // Cancelled — refresh the tree to revert the checkbox UI
            this._onDidChangeTreeData.fire();
          }
        }
      }
    });
  }

  /**
   * Returns the tree item representation for a given element.
   * @param element - The tree item element.
   */
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Retrieves the child elements for a given tree item.
   * If no parent element is provided, returns the list of smells.
   * @param element - The parent tree item (optional).
   */
  getChildren(element?: SmellItem): Thenable<vscode.TreeItem[]> {
    if (!element) {
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
   * Toggles the enabled state of a specific smell and updates the configuration file.
   * Also clears the smell cache for affected files.
   * @param smellKey - The key of the smell to toggle.
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
   * Updates the value of a specific smell option and saves the configuration.
   * Also clears the smell cache for affected files.
   * @param smellKey - The key of the smell.
   * @param optionKey - The key of the option.
   * @param newValue - The new value to set.
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

  /**
   * Refreshes the tree view, updating the UI.
   */
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Enables or disables all smells in the filter and updates the configuration.
   * Also clears the smell cache for affected files.
   * @param enabled - Whether all smells should be enabled or disabled.
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
   * Clears smell cache and marks all cached file results as outdated.
   */
  async invalidateCachedSmellsForAffectedFiles(): Promise<void> {
    const cache = this.cacheManager.getFullSmellCache();

    for (const filePath of Object.keys(cache)) {
      await this.cacheManager.clearCachedSmellsForFile(filePath);
      this.smellsViewProvider.markFileAsOutdated(filePath);
    }

    this.metricsViewProvider.refresh();
  }

  /**
   * Prompts the user to confirm a smell filter change.
   * Displays a modal warning that changing filters will invalidate cached analysis results.
   * If the user confirms, returns true. If the user cancels, returns false.
   *
   * @returns Whether the user chose to proceed with the filter change.
   */
  private async confirmFilterChange(): Promise<boolean> {
    const result = await vscode.window.showWarningMessage(
      'Changing smell filters will invalidate existing analysis results. Do you want to continue?',
      { modal: true },
      'Yes',
    );
    return result === 'Yes';
  }
}

/**
 * Represents a smell item in the tree view.
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
 * Represents an option item for a smell in the tree view.
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
