/* eslint-disable unused-imports/no-unused-imports */
import * as vscode from 'vscode';
import path from 'path';

import { envConfig } from '../../src/utils/envConfig';
import { WorkspaceModifiedListener } from '../../src/listeners/workspaceModifiedListener';
import { SmellsCacheManager } from '../../src/context/SmellsCacheManager';
import { SmellsViewProvider } from '../../src/providers/SmellsViewProvider';
import { MetricsViewProvider } from '../../src/providers/MetricsViewProvider';
import { ecoOutput } from '../../src/extension';
import { detectSmellsFile } from '../../src/commands/detection/detectSmells';

// Mock dependencies
jest.mock('path', () => ({
  basename: jest.fn((path) => path),
}));
jest.mock('../../src/extension');
jest.mock('../../src/commands/detection/detectSmells');
jest.mock('../../src/utils/envConfig');

describe('WorkspaceModifiedListener', () => {
  let mockContext: vscode.ExtensionContext;
  let mockSmellsCacheManager: jest.Mocked<SmellsCacheManager>;
  let mockSmellsViewProvider: jest.Mocked<SmellsViewProvider>;
  let mockMetricsViewProvider: jest.Mocked<MetricsViewProvider>;
  let listener: WorkspaceModifiedListener;

  beforeEach(() => {
    jest.clearAllMocks();

    mockContext = {
      workspaceState: {
        get: jest.fn(),
      },
    } as unknown as vscode.ExtensionContext;

    mockSmellsCacheManager = {
      hasFileInCache: jest.fn(),
      hasCachedSmells: jest.fn(),
      clearCachedSmellsForFile: jest.fn(),
      clearCachedSmellsByPath: jest.fn(),
      getAllFilePaths: jest.fn(() => []),
    } as unknown as jest.Mocked<SmellsCacheManager>;

    mockSmellsViewProvider = {
      setStatus: jest.fn(),
      removeFile: jest.fn(),
      refresh: jest.fn(),
    } as unknown as jest.Mocked<SmellsViewProvider>;

    mockMetricsViewProvider = {
      refresh: jest.fn(),
    } as unknown as jest.Mocked<MetricsViewProvider>;
  });

  describe('Initialization', () => {
    it('should initialize without workspace path', () => {
      (mockContext.workspaceState.get as jest.Mock).mockReturnValue(undefined);
      new WorkspaceModifiedListener(
        mockContext,
        mockSmellsCacheManager,
        mockSmellsViewProvider,
        mockMetricsViewProvider,
      );
      expect(ecoOutput.trace).toHaveBeenCalledWith(
        '[WorkspaceListener] No workspace configured - skipping file watcher',
      );
    });

    it('should initialize with workspace path', () => {
      (mockContext.workspaceState.get as jest.Mock).mockReturnValue('/project/path');
      listener = new WorkspaceModifiedListener(
        mockContext,
        mockSmellsCacheManager,
        mockSmellsViewProvider,
        mockMetricsViewProvider,
      );

      console.log((ecoOutput.trace as jest.Mock).mock);
      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalled();
      expect(ecoOutput.trace).toHaveBeenCalledWith(
        '[WorkspaceListener] Watching Python files in /project/path',
      );
    });
  });

  describe('File Change Handling', () => {
    beforeEach(() => {
      (mockContext.workspaceState.get as jest.Mock).mockReturnValue('/project/path');
      listener = new WorkspaceModifiedListener(
        mockContext,
        mockSmellsCacheManager,
        mockSmellsViewProvider,
        mockMetricsViewProvider,
      );
    });

    it('should handle file change with existing cache', async () => {
      const filePath = '/project/path/file.py';
      (mockSmellsCacheManager.hasFileInCache as jest.Mock).mockReturnValue(true);

      await listener['handleFileChange'](filePath);

      expect(mockSmellsCacheManager.clearCachedSmellsForFile).toHaveBeenCalledWith(
        filePath,
      );
      expect(mockSmellsViewProvider.setStatus).toHaveBeenCalledWith(
        filePath,
        'outdated',
      );
      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
      expect(mockSmellsViewProvider.refresh).toHaveBeenCalled();
    });

    it('should skip file change without cache', async () => {
      const filePath = '/project/path/file.py';
      (mockSmellsCacheManager.hasFileInCache as jest.Mock).mockReturnValue(false);

      await listener['handleFileChange'](filePath);

      expect(mockSmellsCacheManager.clearCachedSmellsForFile).not.toHaveBeenCalled();
      expect(ecoOutput.trace).toHaveBeenCalledWith(
        '[WorkspaceListener] No cache to invalidate for /project/path/file.py',
      );
    });

    it('should handle file change errors', async () => {
      const filePath = '/project/path/file.py';
      (mockSmellsCacheManager.hasFileInCache as jest.Mock).mockReturnValue(true);
      (
        mockSmellsCacheManager.clearCachedSmellsForFile as jest.Mock
      ).mockRejectedValue(new Error('Cache error'));

      await listener['handleFileChange'](filePath);

      expect(ecoOutput.error).toHaveBeenCalledWith(
        expect.stringContaining('Error handling file change: Cache error'),
      );
    });
  });

  describe('File Deletion Handling', () => {
    beforeEach(() => {
      (mockContext.workspaceState.get as jest.Mock).mockReturnValue('/project/path');
      listener = new WorkspaceModifiedListener(
        mockContext,
        mockSmellsCacheManager,
        mockSmellsViewProvider,
        mockMetricsViewProvider,
      );
    });

    it('should handle file deletion with cache', async () => {
      const filePath = '/project/path/file.py';
      (mockSmellsCacheManager.hasCachedSmells as jest.Mock).mockReturnValue(true);
      (mockSmellsViewProvider.removeFile as jest.Mock).mockReturnValue(true);

      await listener['handleFileDeletion'](filePath);

      expect(mockSmellsCacheManager.clearCachedSmellsByPath).toHaveBeenCalledWith(
        filePath,
      );
      expect(mockSmellsViewProvider.removeFile).toHaveBeenCalledWith(filePath);
      // expect(vscode.window.showInformationMessage).toHaveBeenCalled();
      expect(mockSmellsViewProvider.refresh).toHaveBeenCalled();
    });

    it('should handle file deletion without cache', async () => {
      const filePath = '/project/path/file.py';
      (mockSmellsCacheManager.hasCachedSmells as jest.Mock).mockReturnValue(false);
      (mockSmellsViewProvider.removeFile as jest.Mock).mockReturnValue(false);

      await listener['handleFileDeletion'](filePath);

      expect(mockSmellsCacheManager.clearCachedSmellsByPath).not.toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });

    it('should handle deletion errors', async () => {
      const filePath = '/project/path/file.py';
      (mockSmellsCacheManager.hasCachedSmells as jest.Mock).mockReturnValue(true);
      (
        mockSmellsCacheManager.clearCachedSmellsByPath as jest.Mock
      ).mockRejectedValue(new Error('Deletion error'));

      await listener['handleFileDeletion'](filePath);

      expect(ecoOutput.error).toHaveBeenCalledWith(
        expect.stringContaining('Error clearing cache: Deletion error'),
      );
    });
  });

  describe('Save Listener', () => {
    it('should trigger smell detection on Python file save when enabled', () => {
      (mockContext.workspaceState.get as jest.Mock).mockReturnValue('/project/path');
      (
        require('../../src/extension').isSmellLintingEnabled as jest.Mock
      ).mockReturnValue(true);

      listener = new WorkspaceModifiedListener(
        mockContext,
        mockSmellsCacheManager,
        mockSmellsViewProvider,
        mockMetricsViewProvider,
      );

      // Trigger save event
      const onDidSave = (vscode.workspace.onDidSaveTextDocument as jest.Mock).mock
        .calls[0][0];
      const mockDocument = {
        languageId: 'python',
        uri: { fsPath: '/project/path/file.py' },
      };
      onDidSave(mockDocument);

      expect(detectSmellsFile).toHaveBeenCalledWith(
        '/project/path/file.py',
        mockSmellsViewProvider,
        mockSmellsCacheManager,
      );
      expect(ecoOutput.info).toHaveBeenCalledWith(
        '[WorkspaceListener] Smell linting is ON — auto-detecting smells for /project/path/file.py',
      );
    });

    it('should skip non-Python files on save', () => {
      (mockContext.workspaceState.get as jest.Mock).mockReturnValue('/project/path');

      listener = new WorkspaceModifiedListener(
        mockContext,
        mockSmellsCacheManager,
        mockSmellsViewProvider,
        mockMetricsViewProvider,
      );

      // Trigger save event
      const onDidSave = (vscode.workspace.onDidSaveTextDocument as jest.Mock).mock
        .calls[0][0];
      const mockDocument = {
        languageId: 'javascript',
        uri: { fsPath: '/project/path/file.js' },
      };
      onDidSave(mockDocument);

      expect(detectSmellsFile).not.toHaveBeenCalled();
    });
  });

  describe('Disposal', () => {
    it('should clean up resources on dispose', () => {
      (mockContext.workspaceState.get as jest.Mock).mockReturnValue('/project/path');
      listener = new WorkspaceModifiedListener(
        mockContext,
        mockSmellsCacheManager,
        mockSmellsViewProvider,
        mockMetricsViewProvider,
      );

      listener.dispose();

      expect(listener['fileWatcher']?.dispose).toHaveBeenCalled();
      expect(listener['saveListener']?.dispose).toHaveBeenCalled();
      expect(ecoOutput.trace).toHaveBeenCalledWith(
        '[WorkspaceListener] Disposed all listeners',
      );
    });
  });
});
