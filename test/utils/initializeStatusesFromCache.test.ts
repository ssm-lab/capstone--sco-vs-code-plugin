// test/cacheInitialization.test.ts
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import { initializeStatusesFromCache } from '../../src/utils/initializeStatusesFromCache';
import { SmellsViewProvider } from '../../src/providers/SmellsViewProvider';
import { SmellsCacheManager } from '../../src/context/SmellsCacheManager';
import { ecoOutput } from '../../src/extension';
import { envConfig } from '../../src/utils/envConfig';

// Mock the external dependencies
jest.mock('fs/promises');
jest.mock('../../src/extension');
jest.mock('../../src/utils/envConfig');
jest.mock('../../src/providers/SmellsViewProvider');
jest.mock('../../src/context/SmellsCacheManager');

describe('initializeStatusesFromCache', () => {
  let context: vscode.ExtensionContext;
  let smellsViewProvider: SmellsViewProvider;
  let smellsCacheManager: SmellsCacheManager;
  const mockWorkspacePath = '/workspace/path';

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup mock instances
    context = {
      workspaceState: {
        get: jest.fn(),
      },
    } as unknown as vscode.ExtensionContext;

    smellsViewProvider = new SmellsViewProvider(context);
    smellsCacheManager = new SmellsCacheManager(context);

    // Mock envConfig
    (envConfig.WORKSPACE_CONFIGURED_PATH as any) = 'WORKSPACE_PATH_KEY';
  });

  it('should skip initialization when no workspace path is configured', async () => {
    (context.workspaceState.get as jest.Mock).mockReturnValue(undefined);

    await initializeStatusesFromCache(
      context,
      smellsCacheManager,
      smellsViewProvider,
    );

    expect(ecoOutput.warn).toHaveBeenCalledWith(
      expect.stringContaining('No configured workspace path found'),
    );
    expect(smellsCacheManager.getAllFilePaths).not.toHaveBeenCalled();
  });

  it('should remove files outside the workspace from cache', async () => {
    const outsidePath = '/other/path/file.py';
    (context.workspaceState.get as jest.Mock).mockReturnValue(mockWorkspacePath);
    (smellsCacheManager.getAllFilePaths as jest.Mock).mockReturnValue([outsidePath]);

    await initializeStatusesFromCache(
      context,
      smellsCacheManager,
      smellsViewProvider,
    );

    expect(smellsCacheManager.clearCachedSmellsForFile).toHaveBeenCalledWith(
      outsidePath,
    );
    expect(ecoOutput.trace).toHaveBeenCalledWith(
      expect.stringContaining('File outside workspace'),
    );
    expect(ecoOutput.info).toHaveBeenCalledWith(
      expect.stringContaining('1 files removed from cache'),
    );
  });

  it('should remove non-existent files from cache', async () => {
    const filePath = `${mockWorkspacePath}/file.py`;
    (context.workspaceState.get as jest.Mock).mockReturnValue(mockWorkspacePath);
    (smellsCacheManager.getAllFilePaths as jest.Mock).mockReturnValue([filePath]);
    (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));

    await initializeStatusesFromCache(
      context,
      smellsCacheManager,
      smellsViewProvider,
    );

    expect(smellsCacheManager.clearCachedSmellsForFile).toHaveBeenCalledWith(
      filePath,
    );
    expect(ecoOutput.trace).toHaveBeenCalledWith(
      expect.stringContaining('File not found - removing from cache'),
    );
  });

  it('should set status for files with smells', async () => {
    const filePath = `${mockWorkspacePath}/file.py`;
    const mockSmells = [{ id: 'smell1' }];
    (context.workspaceState.get as jest.Mock).mockReturnValue(mockWorkspacePath);
    (smellsCacheManager.getAllFilePaths as jest.Mock).mockReturnValue([filePath]);
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (smellsCacheManager.getCachedSmells as jest.Mock).mockReturnValue(mockSmells);

    await initializeStatusesFromCache(
      context,
      smellsCacheManager,
      smellsViewProvider,
    );

    expect(smellsViewProvider.setStatus).toHaveBeenCalledWith(filePath, 'passed');
    expect(smellsViewProvider.setSmells).toHaveBeenCalledWith(filePath, mockSmells);
    expect(ecoOutput.trace).toHaveBeenCalledWith(
      expect.stringContaining('Found 1 smells for file'),
    );
  });

  it('should set status for clean files', async () => {
    const filePath = `${mockWorkspacePath}/clean.py`;
    (context.workspaceState.get as jest.Mock).mockReturnValue(mockWorkspacePath);
    (smellsCacheManager.getAllFilePaths as jest.Mock).mockReturnValue([filePath]);
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (smellsCacheManager.getCachedSmells as jest.Mock).mockReturnValue([]);

    await initializeStatusesFromCache(
      context,
      smellsCacheManager,
      smellsViewProvider,
    );

    expect(smellsViewProvider.setStatus).toHaveBeenCalledWith(filePath, 'no_issues');
    expect(ecoOutput.trace).toHaveBeenCalledWith(
      expect.stringContaining('File has no smells'),
    );
  });

  it('should log correct summary statistics', async () => {
    const files = [
      `${mockWorkspacePath}/file1.py`, // with smells
      `${mockWorkspacePath}/file2.py`, // clean
      '/outside/path/file3.py', // outside workspace
      `${mockWorkspacePath}/missing.py`, // will fail access
    ];
    (context.workspaceState.get as jest.Mock).mockReturnValue(mockWorkspacePath);
    (smellsCacheManager.getAllFilePaths as jest.Mock).mockReturnValue(files);
    (fs.access as jest.Mock)
      .mockResolvedValueOnce(undefined) // file1.py exists
      .mockResolvedValueOnce(undefined) // file2.py exists
      .mockRejectedValueOnce(new Error('File not found')); // missing.py doesn't exist
    (smellsCacheManager.getCachedSmells as jest.Mock)
      .mockReturnValueOnce([{ id: 'smell1' }]) // file1.py has smells
      .mockReturnValueOnce([]); // file2.py is clean

    await initializeStatusesFromCache(
      context,
      smellsCacheManager,
      smellsViewProvider,
    );

    expect(ecoOutput.info).toHaveBeenCalledWith(
      expect.stringContaining(
        '2 valid files (1 with smells, 1 clean), 2 files removed from cache',
      ),
    );
  });
});
