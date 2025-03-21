import * as vscode from 'vscode';
import { FilterSmellConfig, loadSmells, saveSmells } from '../utils/smellsData';

/**
 * Provides a tree view for filtering code smells within the VS Code extension.
 */
export class FilterSmellsProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined | void
  > = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private treeView?: vscode.TreeView<vscode.TreeItem>;
  private smells: Record<string, FilterSmellConfig> = {};

  constructor(private context: vscode.ExtensionContext) {
    this.smells = loadSmells();
  }

  /**
   * Associates a TreeView instance with the provider and listens for checkbox state changes.
   * @param treeView - The TreeView instance.
   */
  setTreeView(treeView: vscode.TreeView<vscode.TreeItem>): void {
    this.treeView = treeView;

    this.treeView.onDidChangeCheckboxState((event) => {
      event.items.forEach((item) => {
        if (item[0] instanceof SmellItem) {
          this.toggleSmell(item[0].key);
        }
      });
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
        Object.keys(this.smells).map((smellKey) => {
          const smell = this.smells[smellKey];
          return new SmellItem(
            smellKey,
            smell.name,
            smell.enabled,
            smell.analyzer_options && Object.keys(smell.analyzer_options).length > 0
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
   * @param smellKey - The key of the smell to toggle.
   */
  toggleSmell(smellKey: string): void {
    if (this.smells[smellKey]) {
      this.smells[smellKey].enabled = !this.smells[smellKey].enabled;
      saveSmells(this.smells);
      this._onDidChangeTreeData.fire();
    }
  }

  /**
   * Updates the value of a specific smell option and saves the configuration.
   * @param smellKey - The key of the smell.
   * @param optionKey - The key of the option.
   * @param newValue - The new value to set.
   */
  updateOption(
    smellKey: string,
    optionKey: string,
    newValue: number | string,
  ): void {
    if (this.smells[smellKey]?.analyzer_options?.[optionKey]) {
      this.smells[smellKey].analyzer_options[optionKey].value = newValue;
      saveSmells(this.smells);
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
   * @param enabled - Whether all smells should be enabled or disabled.
   */
  setAllSmellsEnabled(enabled: boolean): void {
    Object.keys(this.smells).forEach((key) => {
      this.smells[key].enabled = enabled;
    });
    saveSmells(this.smells);
    this._onDidChangeTreeData.fire();
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
