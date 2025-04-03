// test/wipeWorkCache.test.ts
import * as vscode from 'vscode';
import { SmellsCacheManager } from '../../src/context/SmellsCacheManager';
import { SmellsViewProvider } from '../../src/providers/SmellsViewProvider';
import { wipeWorkCache } from '../../src/commands/detection/wipeWorkCache';
import context from '../mocks/context-mock';

// Mock the external dependencies
jest.mock('vscode');
jest.mock('../../src/context/SmellsCacheManager');
jest.mock('../../src/providers/SmellsViewProvider');

describe('wipeWorkCache', () => {
  let smellsCacheManager: SmellsCacheManager;
  let smellsViewProvider: SmellsViewProvider;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup mock instances
    smellsCacheManager = new SmellsCacheManager(
      context as unknown as vscode.ExtensionContext,
    );
    smellsViewProvider = new SmellsViewProvider(
      context as unknown as vscode.ExtensionContext,
    );

    // Mock the showWarningMessage to return undefined by default
    (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue(undefined);
  });

  it('should show confirmation dialog before clearing cache', async () => {
    await wipeWorkCache(smellsCacheManager, smellsViewProvider);

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      'Are you sure you want to clear the entire workspace analysis? This action cannot be undone.',
      { modal: true },
      'Confirm',
    );
  });

  it('should clear cache and refresh UI when user confirms', async () => {
    // Mock user confirming the action
    (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Confirm');

    await wipeWorkCache(smellsCacheManager, smellsViewProvider);

    expect(smellsCacheManager.clearAllCachedSmells).toHaveBeenCalled();
    expect(smellsViewProvider.clearAllStatuses).toHaveBeenCalled();
    expect(smellsViewProvider.refresh).toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Workspace analysis cleared successfully.',
    );
  });

  it('should not clear cache when user cancels', async () => {
    // Mock user cancelling the action
    (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue(undefined);

    await wipeWorkCache(smellsCacheManager, smellsViewProvider);

    expect(smellsCacheManager.clearAllCachedSmells).not.toHaveBeenCalled();
    expect(smellsViewProvider.clearAllStatuses).not.toHaveBeenCalled();
    expect(smellsViewProvider.refresh).not.toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Operation cancelled.',
    );
  });

  it('should not clear cache when user dismisses dialog', async () => {
    // Mock user dismissing the dialog (different from cancelling)
    (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue(undefined);

    await wipeWorkCache(smellsCacheManager, smellsViewProvider);

    expect(smellsCacheManager.clearAllCachedSmells).not.toHaveBeenCalled();
    expect(smellsViewProvider.clearAllStatuses).not.toHaveBeenCalled();
    expect(smellsViewProvider.refresh).not.toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Operation cancelled.',
    );
  });

  it('should handle case where user clicks something other than Confirm', async () => {
    // Mock user clicking something else (e.g., a different button if more were added)
    (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue(
      'Other Option',
    );

    await wipeWorkCache(smellsCacheManager, smellsViewProvider);

    expect(smellsCacheManager.clearAllCachedSmells).not.toHaveBeenCalled();
    expect(smellsViewProvider.clearAllStatuses).not.toHaveBeenCalled();
    expect(smellsViewProvider.refresh).not.toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Operation cancelled.',
    );
  });

  it('should show success message only after successful cache clearing', async () => {
    // Mock user confirming the action
    (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Confirm');

    // Mock a successful cache clearing
    (smellsCacheManager.clearAllCachedSmells as jest.Mock).mockImplementation(() => {
      // Simulate successful clearing
    });

    await wipeWorkCache(smellsCacheManager, smellsViewProvider);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Workspace analysis cleared successfully.',
    );
  });

  it('should still show cancellation message if confirmation is aborted', async () => {
    // Simulate the confirmation dialog being closed without any selection
    (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue(undefined);

    await wipeWorkCache(smellsCacheManager, smellsViewProvider);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Operation cancelled.',
    );
    expect(vscode.window.showInformationMessage).not.toHaveBeenCalledWith(
      'Workspace analysis cleared successfully.',
    );
  });
});
