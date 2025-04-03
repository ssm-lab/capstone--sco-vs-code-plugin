// test/detection.test.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  detectSmellsFile,
  detectSmellsFolder,
} from '../../src/commands/detection/detectSmells';
import { SmellsViewProvider } from '../../src/providers/SmellsViewProvider';
import { SmellsCacheManager } from '../../src/context/SmellsCacheManager';
import { serverStatus, ServerStatusType } from '../../src/emitters/serverStatus';
import { ecoOutput } from '../../src/extension';

import context from '../mocks/context-mock';

// Mock the external dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('../../src/api/backend');
jest.mock('../../src/utils/smellsData');
jest.mock('../../src/providers/SmellsViewProvider');
jest.mock('../../src/context/SmellsCacheManager');
jest.mock('../../src/emitters/serverStatus');
jest.mock('../../src/extension');

describe('detectSmellsFile', () => {
  let smellsViewProvider: SmellsViewProvider;
  let smellsCacheManager: SmellsCacheManager;
  const mockFilePath = '/path/to/file.py';

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup mock instances
    smellsViewProvider = new SmellsViewProvider(
      context as unknown as vscode.ExtensionContext,
    );
    smellsCacheManager = new SmellsCacheManager(
      context as unknown as vscode.ExtensionContext,
    );

    // Mock vscode.Uri
    (vscode.Uri.file as jest.Mock).mockImplementation((path) => ({
      scheme: 'file',
      path,
    }));

    // Mock path.basename
    (path.basename as jest.Mock).mockImplementation((p) => p.split('/').pop());
  });

  it('should skip non-file URIs', async () => {
    (vscode.Uri.file as jest.Mock).mockReturnValueOnce({ scheme: 'untitled' });

    await detectSmellsFile(mockFilePath, smellsViewProvider, smellsCacheManager);

    expect(smellsViewProvider.setStatus).not.toHaveBeenCalled();
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
  });

  it('should skip non-Python files', async () => {
    const nonPythonPath = '/path/to/file.txt';

    await detectSmellsFile(nonPythonPath, smellsViewProvider, smellsCacheManager);

    expect(smellsViewProvider.setStatus).not.toHaveBeenCalled();
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
  });

  it('should use cached smells when available', async () => {
    const mockCachedSmells = [{ id: 'smell1' }];
    (smellsCacheManager.hasCachedSmells as jest.Mock).mockReturnValue(true);
    (smellsCacheManager.getCachedSmells as jest.Mock).mockReturnValue(
      mockCachedSmells,
    );

    await detectSmellsFile(mockFilePath, smellsViewProvider, smellsCacheManager);

    expect(ecoOutput.info).toHaveBeenCalledWith(
      expect.stringContaining('Using cached results'),
    );
    expect(smellsViewProvider.setStatus).toHaveBeenCalledWith(
      mockFilePath,
      'passed',
    );
    expect(smellsViewProvider.setSmells).toHaveBeenCalledWith(
      mockFilePath,
      mockCachedSmells,
    );
  });

  it('should handle server down state', async () => {
    (serverStatus.getStatus as jest.Mock).mockReturnValue(ServerStatusType.DOWN);
    (smellsCacheManager.hasCachedSmells as jest.Mock).mockReturnValue(false);

    await detectSmellsFile(mockFilePath, smellsViewProvider, smellsCacheManager);

    expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    expect(smellsViewProvider.setStatus).toHaveBeenCalledWith(
      mockFilePath,
      'server_down',
    );
  });

  it('should warn when no smells are enabled', async () => {
    (serverStatus.getStatus as jest.Mock).mockReturnValue(ServerStatusType.UP);
    (smellsCacheManager.hasCachedSmells as jest.Mock).mockReturnValue(false);
    (
      require('../../src/utils/smellsData').getEnabledSmells as jest.Mock
    ).mockReturnValue({});

    await detectSmellsFile(mockFilePath, smellsViewProvider, smellsCacheManager);

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      'No smell detectors enabled in settings',
    );
    expect(smellsViewProvider.setStatus).not.toHaveBeenCalledWith(
      mockFilePath,
      'queued',
    );
  });

  it('should fetch and process smells successfully', async () => {
    const mockSmells = [{ id: 'smell1' }];
    (serverStatus.getStatus as jest.Mock).mockReturnValue(ServerStatusType.UP);
    (smellsCacheManager.hasCachedSmells as jest.Mock).mockReturnValue(false);
    (
      require('../../src/utils/smellsData').getEnabledSmells as jest.Mock
    ).mockReturnValue({
      smell1: { options: {} },
    });
    (require('../../src/api/backend').fetchSmells as jest.Mock).mockResolvedValue({
      smells: mockSmells,
      status: 200,
    });

    await detectSmellsFile(mockFilePath, smellsViewProvider, smellsCacheManager);

    expect(smellsViewProvider.setStatus).toHaveBeenCalledWith(
      mockFilePath,
      'queued',
    );
    expect(smellsCacheManager.setCachedSmells).toHaveBeenCalledWith(
      mockFilePath,
      mockSmells,
    );
    expect(smellsViewProvider.setSmells).toHaveBeenCalledWith(
      mockFilePath,
      mockSmells,
    );
    expect(smellsViewProvider.setStatus).toHaveBeenCalledWith(
      mockFilePath,
      'passed',
    );
    expect(ecoOutput.info).toHaveBeenCalledWith(
      expect.stringContaining('Detected 1 smells'),
    );
  });

  it('should handle no smells found', async () => {
    (serverStatus.getStatus as jest.Mock).mockReturnValue(ServerStatusType.UP);
    (smellsCacheManager.hasCachedSmells as jest.Mock).mockReturnValue(false);
    (
      require('../../src/utils/smellsData').getEnabledSmells as jest.Mock
    ).mockReturnValue({
      smell1: { options: {} },
    });
    (require('../../src/api/backend').fetchSmells as jest.Mock).mockResolvedValue({
      smells: [],
      status: 200,
    });

    await detectSmellsFile(mockFilePath, smellsViewProvider, smellsCacheManager);

    expect(smellsViewProvider.setStatus).toHaveBeenCalledWith(
      mockFilePath,
      'no_issues',
    );
    expect(smellsCacheManager.setCachedSmells).toHaveBeenCalledWith(
      mockFilePath,
      [],
    );
    expect(ecoOutput.info).toHaveBeenCalledWith(
      expect.stringContaining('File has no detectable smells'),
    );
  });

  it('should handle API errors', async () => {
    (serverStatus.getStatus as jest.Mock).mockReturnValue(ServerStatusType.UP);
    (smellsCacheManager.hasCachedSmells as jest.Mock).mockReturnValue(false);
    (
      require('../../src/utils/smellsData').getEnabledSmells as jest.Mock
    ).mockReturnValue({
      smell1: { options: {} },
    });
    (require('../../src/api/backend').fetchSmells as jest.Mock).mockResolvedValue({
      smells: [],
      status: 500,
    });

    await detectSmellsFile(mockFilePath, smellsViewProvider, smellsCacheManager);

    expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    expect(smellsViewProvider.setStatus).toHaveBeenCalledWith(
      mockFilePath,
      'failed',
    );
  });

  it('should handle unexpected errors', async () => {
    (serverStatus.getStatus as jest.Mock).mockReturnValue(ServerStatusType.UP);
    (smellsCacheManager.hasCachedSmells as jest.Mock).mockReturnValue(false);
    (
      require('../../src/utils/smellsData').getEnabledSmells as jest.Mock
    ).mockReturnValue({
      smell1: { options: {} },
    });
    (require('../../src/api/backend').fetchSmells as jest.Mock).mockRejectedValue(
      new Error('API failed'),
    );

    await detectSmellsFile(mockFilePath, smellsViewProvider, smellsCacheManager);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Analysis failed: API failed',
    );
    expect(smellsViewProvider.setStatus).toHaveBeenCalledWith(
      mockFilePath,
      'failed',
    );
    expect(ecoOutput.error).toHaveBeenCalled();
  });
});

describe('detectSmellsFolder', () => {
  let smellsViewProvider: SmellsViewProvider;
  let smellsCacheManager: SmellsCacheManager;
  const mockFolderPath = '/path/to/folder';

  beforeEach(() => {
    jest.clearAllMocks();

    smellsViewProvider = new SmellsViewProvider(
      context as unknown as vscode.ExtensionContext,
    );
    smellsCacheManager = new SmellsCacheManager(
      context as unknown as vscode.ExtensionContext,
    );

    // Mock vscode.window.withProgress
    (vscode.window.withProgress as jest.Mock).mockImplementation((_, callback) => {
      return callback();
    });

    // Mock path.basename
    (path.basename as jest.Mock).mockImplementation((p) => p.split('/').pop());
  });

  it('should show progress notification', async () => {
    (fs.readdirSync as jest.Mock).mockReturnValue([]);

    await detectSmellsFolder(mockFolderPath, smellsViewProvider, smellsCacheManager);

    expect(vscode.window.withProgress).toHaveBeenCalled();
  });

  it('should handle empty folder', async () => {
    (fs.readdirSync as jest.Mock).mockReturnValue([]);

    await detectSmellsFolder(mockFolderPath, smellsViewProvider, smellsCacheManager);

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('No Python files found'),
    );
    expect(ecoOutput.info).toHaveBeenCalledWith(
      expect.stringContaining('Found 0 files to analyze'),
    );
  });

  it('should process Python files in folder', async () => {
    const mockFiles = ['file1.py', 'subdir/file2.py', 'ignore.txt'];

    (fs.readdirSync as jest.Mock).mockImplementation((dir) => {
      if (dir === mockFolderPath) return mockFiles;
      if (dir === mockFolderPath + 'subdir') return ['file2.py'];
      console.log('Here');
      return mockFiles;
    });

    jest
      .spyOn(fs, 'statSync')
      .mockReturnValueOnce({
        isDirectory: (): boolean => false,
        isFile: (): boolean => true,
      } as unknown as fs.Stats)
      .mockReturnValueOnce({
        isDirectory: (): boolean => true,
      } as unknown as fs.Stats)
      .mockReturnValueOnce({
        isDirectory: (): boolean => false,
        isFile: (): boolean => true,
      } as unknown as fs.Stats)
      .mockReturnValueOnce({
        isDirectory: (): boolean => false,
        isFile: (): boolean => true,
      } as unknown as fs.Stats);

    jest
      .spyOn(String.prototype, 'endsWith')
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    jest
      .spyOn(path, 'join')
      .mockReturnValueOnce(mockFolderPath + '/file1.py')
      .mockReturnValueOnce(mockFolderPath + '/subdir')
      .mockReturnValueOnce(mockFolderPath + '/subdir' + '/file2.py')
      .mockReturnValueOnce(mockFolderPath + 'ignore.txt');

    await detectSmellsFolder(mockFolderPath, smellsViewProvider, smellsCacheManager);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Analyzing 2 Python files...',
    );
    expect(ecoOutput.info).toHaveBeenCalledWith(
      expect.stringContaining('Found 2 files to analyze'),
    );
  });

  it('should handle directory scan errors', async () => {
    (fs.readdirSync as jest.Mock).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    await detectSmellsFolder(mockFolderPath, smellsViewProvider, smellsCacheManager);

    expect(ecoOutput.error).toHaveBeenCalledWith(
      expect.stringContaining('Scan error: Permission denied'),
    );
  });
});
