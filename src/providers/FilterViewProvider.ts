import * as vscode from 'vscode';
import { FilterSmellConfig, getFilterSmells, saveSmells } from '../utils/smellsData';
import { MetricsViewProvider } from './MetricsViewProvider';
import { SmellsCacheManager } from '../context/SmellsCacheManager';
import { SmellsViewProvider } from './SmellsViewProvider';

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
    private metricsViewProvider: MetricsViewProvider,
    private smellsCacheManager: SmellsCacheManager,
    private smellsViewProvider: SmellsViewProvider,
  ) {
    this.smells = getFilterSmells();
  }

  setTreeView(treeView: vscode.TreeView<vscode.TreeItem>): void {
    this.treeView = treeView;

    this.treeView.onDidChangeCheckboxState(async (event) => {
      for (const [item] of event.items) {
        if (item instanceof SmellItem) {
          const confirmed = await this.confirmFilterChange();
          if (confirmed) {
            await this.toggleSmell(item.key);
          } else {
            this._onDidChangeTreeData.fire();
          }
        }
      }
    });
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

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

  async toggleSmell(smellKey: string): Promise<void> {
    if (this.smells[smellKey]) {
      this.smells[smellKey].enabled = !this.smells[smellKey].enabled;
      saveSmells(this.smells);
      await this.invalidateCachedSmellsForAffectedFiles();
      this._onDidChangeTreeData.fire();
    }
  }

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

  async invalidateCachedSmellsForAffectedFiles(): Promise<void> {
    const cachedFilePaths = this.smellsCacheManager.getAllFilePaths();

    for (const filePath of cachedFilePaths) {
      this.smellsCacheManager.clearCachedSmellsForFile(filePath);
      this.smellsViewProvider.setStatus(filePath, 'outdated');
    }

    this.metricsViewProvider.refresh();
    this.smellsViewProvider.refresh();
  }

  private async confirmFilterChange(): Promise<boolean> {
    const suppressWarning = this.context.workspaceState.get<boolean>(
      'ecooptimizer.suppressFilterWarning',
      false,
    );

    if (suppressWarning) {
      return true; // Skip confirmation
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
