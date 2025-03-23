import * as vscode from 'vscode';
import { MetricsViewProvider } from '../providers/MetricsViewProvider';

/**
 * Registers a listener for workspace modifications (file creation, deletion, and changes)
 * and refreshes the MetricsViewProvider when any of these events occur.
 *
 * @param metricsViewProvider - The MetricsViewProvider instance to refresh.
 * @returns A disposable that can be used to unregister the listener.
 */
export function registerWorkspaceModifiedListener(
  metricsViewProvider: MetricsViewProvider,
): vscode.Disposable {
  const watcher = vscode.workspace.createFileSystemWatcher('**/*');

  const onDidCreateDisposable = watcher.onDidCreate(() => {
    metricsViewProvider.refresh();
  });

  const onDidChangeDisposable = watcher.onDidChange(() => {
    metricsViewProvider.refresh();
  });

  const onDidDeleteDisposable = watcher.onDidDelete(() => {
    metricsViewProvider.refresh();
  });

  return vscode.Disposable.from(
    watcher,
    onDidCreateDisposable,
    onDidChangeDisposable,
    onDidDeleteDisposable,
  );
}
