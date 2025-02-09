import * as vscode from 'vscode';
import { wipeWorkCache } from '../commands/wipeWorkCache';
import { ContextManager } from '../context/contextManager';

/**
 * Fetches the current enabled smells from VS Code settings.
 */
export function getEnabledSmells(): { [key: string]: boolean } {
  return vscode.workspace.getConfiguration('ecooptimizer').get('enableSmells', {});
}

/**
 * Handles when a user updates the smell filter in settings.
 * It wipes the cache and notifies the user about changes.
 */
export function handleSmellFilterUpdate(
  previousSmells: { [key: string]: boolean },
  contextManager: ContextManager
) {
  const currentSmells = getEnabledSmells();
  let smellsChanged = false;

  Object.entries(currentSmells).forEach(([smell, isEnabled]) => {
    if (previousSmells[smell] !== isEnabled) {
      smellsChanged = true;
      vscode.window.showInformationMessage(
        isEnabled
          ? `Eco: Enabled detection of ${formatSmellName(smell)}.`
          : `Eco: Disabled detection of ${formatSmellName(smell)}.`
      );
    }
  });

  // If any smell preference changed, wipe the cache
  if (smellsChanged) {
    console.log('Eco: Smell preferences changed! Wiping cache.');
    wipeWorkCache(contextManager, 'settings');
  }
}

/**
 * Formats the smell name from kebab-case to a readable format.
 */
export function formatSmellName(smellKey: string): string {
  return smellKey
    .replace(/-/g, ' ') // Replace hyphens with spaces
    .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize first letter
}
