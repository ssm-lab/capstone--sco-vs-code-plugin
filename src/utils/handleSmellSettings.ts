import * as vscode from 'vscode';
import { wipeWorkCache } from '../commands/wipeWorkCache';
import { ContextManager } from '../context/contextManager';

/**
 * Fetches the current enabled smells from VS Code settings.
 */
export function getEnabledSmells(): {
  [key: string]: boolean;
} {
  const smellConfig = vscode.workspace
    .getConfiguration('detection')
    .get('smells', {}) as { [key: string]: { enabled: boolean; colour: string } };

  return Object.fromEntries(
    Object.entries(smellConfig).map(([smell, config]) => [smell, config.enabled]),
  );
}

/**
 * Handles when a user updates the smell filter in settings.
 * It wipes the cache and notifies the user about changes.
 */
export function handleSmellFilterUpdate(
  previousSmells: { [key: string]: boolean },
  contextManager: ContextManager,
): void {
  const currentSmells = getEnabledSmells();
  let smellsChanged = false;

  Object.entries(currentSmells).forEach(([smell, isEnabled]) => {
    if (previousSmells[smell] !== isEnabled) {
      smellsChanged = true;
      vscode.window.showInformationMessage(
        isEnabled
          ? `Eco: Enabled detection of ${formatSmellName(smell)}.`
          : `Eco: Disabled detection of ${formatSmellName(smell)}.`,
      );
    }
  });

  if (smellsChanged) {
    console.log('Eco: Smell preferences changed! Wiping cache.');
    wipeWorkCache(contextManager, 'settings');
  }
}

/**
 * Formats the smell name from kebab-case to a readable format.
 */
export function formatSmellName(smellKey: string): string {
  return smellKey.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
