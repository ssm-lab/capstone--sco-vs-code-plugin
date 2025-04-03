// utils/trackedDiffEditors.ts
import * as vscode from 'vscode';

export const trackedDiffs = new Set<string>();

export function registerDiffEditor(
  original: vscode.Uri,
  modified: vscode.Uri,
): void {
  trackedDiffs.add(`${original.toString()}::${modified.toString()}`);
}

export function isTrackedDiffEditor(
  original: vscode.Uri,
  modified: vscode.Uri,
): boolean {
  return trackedDiffs.has(`${original.toString()}::${modified.toString()}`);
}

export async function closeAllTrackedDiffEditors(): Promise<void> {
  const tabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs);

  for (const tab of tabs) {
    if (tab.input && (tab.input as any).modified && (tab.input as any).original) {
      const original = (tab.input as any).original as vscode.Uri;
      const modified = (tab.input as any).modified as vscode.Uri;

      if (isTrackedDiffEditor(original, modified)) {
        await vscode.window.tabGroups.close(tab, true);
      }
    }
  }

  trackedDiffs.clear();
}
