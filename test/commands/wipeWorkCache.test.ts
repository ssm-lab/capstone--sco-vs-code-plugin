import mockContextManager from '../mocks/contextManager-mock';
import { wipeWorkCache } from '../../src/commands/wipeWorkCache';
import vscode from '../mocks/vscode-mock';
import { envConfig } from '../mocks/env-config-mock';
import { updateHash } from '../../src/utils/hashDocs';

// mock updateHash function
jest.mock('../../src/utils/hashDocs', () => ({
  updateHash: jest.fn(),
}));

describe('wipeWorkCache', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // reset mocks before each test
  });

  test('should clear stored smells cache with no reason provided', async () => {
    // call wipeWorkCache with contextManagerMock
    await wipeWorkCache(mockContextManager);

    expect(mockContextManager.setWorkspaceData).toHaveBeenCalledWith(
      envConfig.SMELL_MAP_KEY,
      {},
    );
    expect(mockContextManager.setWorkspaceData).toHaveBeenCalledTimes(1); // only the smells cache should be cleared when no reason is provided
  });

  test('should clear stored smells cache when reason is settings', async () => {
    // call wipeWorkCache with contextManagerMock
    await wipeWorkCache(mockContextManager, 'settings');

    expect(mockContextManager.setWorkspaceData).toHaveBeenCalledWith(
      envConfig.SMELL_MAP_KEY,
      {},
    );
    expect(mockContextManager.setWorkspaceData).toHaveBeenCalledTimes(1); // only the smells cache should be cleared when reason is settings
  });

  test('should clear file changes when reason is manual', async () => {
    // call wipeWorkCache with contextManagerMock
    await wipeWorkCache(mockContextManager, 'manual');

    expect(mockContextManager.setWorkspaceData).toHaveBeenCalledWith(
      envConfig.SMELL_MAP_KEY,
      {},
    );
    expect(mockContextManager.setWorkspaceData).toHaveBeenCalledWith(
      envConfig.FILE_CHANGES_KEY,
      {},
    );
    expect(mockContextManager.setWorkspaceData).toHaveBeenCalledTimes(2); // both caches should be cleared when reason is manul
  });

  test('should log when there are no visible text editors', async () => {
    vscode.window.visibleTextEditors = []; // simulate no open editors

    const consoleSpy = jest.spyOn(console, 'log');
    await wipeWorkCache(mockContextManager);

    expect(consoleSpy).toHaveBeenCalledWith('Eco: No open files to update hash.');
  });

  test('should update hashes for visible text editors', async () => {
    vscode.window.visibleTextEditors = [
      {
        document: { fileName: 'file1.py', getText: jest.fn(() => 'file1 content') },
      } as any,
      {
        document: { fileName: 'file2.py', getText: jest.fn(() => 'file2 content') },
      } as any,
    ];

    await wipeWorkCache(mockContextManager);
    expect(updateHash).toHaveBeenCalledTimes(2); // should call updateHash for each open document
  });
  test('should display the correct message for default wipe', async () => {
    await wipeWorkCache(mockContextManager);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Eco: Successfully wiped workspace cache! ✅',
    );
  });

  test('should display the correct message when reason is "settings"', async () => {
    await wipeWorkCache(mockContextManager, 'settings');

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Eco: Smell detection settings changed. Cache wiped to apply updates. ✅',
    );
  });

  test('should display the correct message when reason is "manual"', async () => {
    await wipeWorkCache(mockContextManager, 'manual');

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Eco: Workspace cache manually wiped by user. ✅',
    );
  });

  test('should handle errors and display an error message', async () => {
    mockContextManager.setWorkspaceData.mockRejectedValue(new Error('Mocked Error'));

    const consoleErrorSpy = jest.spyOn(console, 'error');

    await wipeWorkCache(mockContextManager);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Eco: Error while wiping workspace cache:',
      expect.any(Error),
    );
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Eco: Failed to wipe workspace cache. See console for details.',
    );
  });
});
