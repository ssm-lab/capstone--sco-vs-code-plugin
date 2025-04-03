// test/refactor.test.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  refactor,
  startRefactorSession,
} from '../../src/commands/refactor/refactor';
import { SmellsViewProvider } from '../../src/providers/SmellsViewProvider';
import { RefactoringDetailsViewProvider } from '../../src/providers/RefactoringDetailsViewProvider';
import { serverStatus, ServerStatusType } from '../../src/emitters/serverStatus';
import { ecoOutput } from '../../src/extension';
import { envConfig } from '../../src/utils/envConfig';
import context from '../mocks/context-mock';
import { MetricsViewProvider } from '../../src/providers/MetricsViewProvider';
import { SmellsCacheManager } from '../../src/context/SmellsCacheManager';
import { acceptRefactoring } from '../../src/commands/refactor/acceptRefactoring';
import { rejectRefactoring } from '../../src/commands/refactor/rejectRefactoring';

// Mock all external dependencies
jest.mock('vscode');
jest.mock('path');
jest.mock('fs');
jest.mock('../../src/api/backend');
jest.mock('../../src/providers/SmellsViewProvider');
jest.mock('../../src/providers/RefactoringDetailsViewProvider');
jest.mock('../../src/emitters/serverStatus');
jest.mock('../../src/extension');
jest.mock('../../src/utils/refactorActionButtons');
jest.mock('../../src/utils/trackedDiffEditors');

const mockContext = context as unknown as vscode.ExtensionContext;

describe('refactor', () => {
  let smellsViewProvider: SmellsViewProvider;
  let refactoringDetailsViewProvider: RefactoringDetailsViewProvider;
  const mockSmell = {
    symbol: 'testSmell',
    path: '/path/to/file.py',
    type: 'testType',
  } as unknown as Smell;

  beforeEach(() => {
    jest.clearAllMocks();

    smellsViewProvider = new SmellsViewProvider({} as vscode.ExtensionContext);
    refactoringDetailsViewProvider = new RefactoringDetailsViewProvider();

    (path.basename as jest.Mock).mockImplementation((p) => p.split('/').pop());

    (serverStatus.getStatus as jest.Mock).mockReturnValue(ServerStatusType.UP);

    context.workspaceState.get.mockImplementation((key: string) => {
      if (key === envConfig.WORKSPACE_CONFIGURED_PATH) {
        return '/workspace/path';
      }
      return undefined;
    });
  });

  it('should show error when no workspace is configured', async () => {
    (context.workspaceState.get as jest.Mock).mockReturnValue(undefined);

    await refactor(
      smellsViewProvider,
      refactoringDetailsViewProvider,
      mockSmell,
      mockContext,
    );

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Please configure workspace first',
    );
    expect(ecoOutput.error).toHaveBeenCalledWith(
      expect.stringContaining('Refactoring aborted: No workspace configured'),
    );
  });

  it('should show warning when backend is down', async () => {
    (serverStatus.getStatus as jest.Mock).mockReturnValue(ServerStatusType.DOWN);

    await refactor(
      smellsViewProvider,
      refactoringDetailsViewProvider,
      mockSmell,
      mockContext,
    );

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      'Cannot refactor - backend service unavailable',
    );
    expect(smellsViewProvider.setStatus).toHaveBeenCalledWith(
      mockSmell.path,
      'server_down',
    );
  });

  it('should initiate single smell refactoring', async () => {
    const mockRefactoredData = {
      targetFile: {
        original: '/original/path',
        refactored: '/refactored/path',
      },
      affectedFiles: [],
      energySaved: 0.5,
      tempDir: '/temp/dir',
    };

    (
      require('../../src/api/backend').backendRefactorSmell as jest.Mock
    ).mockResolvedValue(mockRefactoredData);

    await refactor(
      smellsViewProvider,
      refactoringDetailsViewProvider,
      mockSmell,
      mockContext,
    );

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('Refactoring testSmell...'),
    );
    expect(smellsViewProvider.setStatus).toHaveBeenCalledWith(
      mockSmell.path,
      'queued',
    );
    expect(mockContext.workspaceState.update).toHaveBeenCalled();
    expect(ecoOutput.info).toHaveBeenCalledWith(
      expect.stringContaining('Refactoring completed for file.py'),
    );
  });

  it('should initiate refactoring all smells of type', async () => {
    const mockRefactoredData = {
      targetFile: {
        original: '/original/path',
        refactored: '/refactored/path',
      },
      affectedFiles: [],
      energySaved: 1.2,
      tempDir: '/temp/dir',
    };

    (
      require('../../src/api/backend').backendRefactorSmellType as jest.Mock
    ).mockResolvedValue(mockRefactoredData);

    await refactor(
      smellsViewProvider,
      refactoringDetailsViewProvider,
      mockSmell,
      mockContext,
      true,
    );

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('Refactoring all smells of type testSmell...'),
    );
    expect(
      require('../../src/api/backend').backendRefactorSmellType,
    ).toHaveBeenCalled();
  });

  it('should handle refactoring failure', async () => {
    const error = new Error('Backend error');
    (
      require('../../src/api/backend').backendRefactorSmell as jest.Mock
    ).mockRejectedValue(error);

    await refactor(
      smellsViewProvider,
      refactoringDetailsViewProvider,
      mockSmell,
      mockContext,
    );

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Refactoring failed. See output for details.',
    );
    expect(ecoOutput.error).toHaveBeenCalledWith(
      expect.stringContaining('Refactoring failed: Backend error'),
    );
    expect(
      refactoringDetailsViewProvider.resetRefactoringDetails,
    ).toHaveBeenCalled();
    expect(
      require('../../src/utils/refactorActionButtons').hideRefactorActionButtons,
    ).toHaveBeenCalled();
    expect(smellsViewProvider.setStatus).toHaveBeenCalledWith(
      mockSmell.path,
      'failed',
    );
  });

  describe('startRefactorSession', () => {
    let refactoringDetailsViewProvider: RefactoringDetailsViewProvider;
    const mockSmell = {
      symbol: 'testSmell',
      path: 'original/path/to/file.py',
    } as unknown as Smell;
    const mockRefactoredData = {
      targetFile: {
        original: 'original/path/to/file.py',
        refactored: 'refactored/path/to/file.py',
      },
      affectedFiles: [],
      energySaved: 0.5,
      tempDir: '/refactored',
    };

    beforeEach(() => {
      jest.clearAllMocks();
      refactoringDetailsViewProvider = new RefactoringDetailsViewProvider();

      // Mock path.basename
      (path.basename as jest.Mock).mockImplementation((p) => p.split('/').pop());

      // Mock vscode.Uri.file
      (vscode.Uri.file as jest.Mock).mockImplementation((path) => ({ path }));
    });

    it('should update refactoring details and show diff', async () => {
      await startRefactorSession(
        mockSmell,
        mockRefactoredData,
        refactoringDetailsViewProvider,
      );

      expect(
        refactoringDetailsViewProvider.updateRefactoringDetails,
      ).toHaveBeenCalledWith(
        mockSmell,
        mockRefactoredData.targetFile,
        mockRefactoredData.affectedFiles,
        mockRefactoredData.energySaved,
      );

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'vscode.diff',
        expect.anything(),
        expect.anything(),
        'Refactoring Comparison (file.py)',
        { preview: false },
      );

      expect(
        require('../../src/utils/trackedDiffEditors').registerDiffEditor,
      ).toHaveBeenCalled();

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'ecooptimizer.refactorView.focus',
      );

      expect(
        require('../../src/utils/refactorActionButtons').showRefactorActionButtons,
      ).toHaveBeenCalled();

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Refactoring complete. Estimated savings: 0.5 kg CO2',
      );
    });

    it('should handle missing energy data', async () => {
      const dataWithoutEnergy = { ...mockRefactoredData, energySaved: undefined };

      await startRefactorSession(
        mockSmell,
        dataWithoutEnergy,
        refactoringDetailsViewProvider,
      );

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Refactoring complete. Estimated savings: N/A kg CO2',
      );
    });
  });

  describe('acceptRefactoring', () => {
    let metricsDataProvider: { updateMetrics: jest.Mock };
    let smellsCacheManager: { clearCachedSmellsForFile: jest.Mock };

    beforeEach(() => {
      metricsDataProvider = {
        updateMetrics: jest.fn(),
      };
      smellsCacheManager = {
        clearCachedSmellsForFile: jest.fn(),
      };

      // Mock refactoring details
      refactoringDetailsViewProvider.targetFile = {
        original: '/original/path',
        refactored: '/refactored/path',
      };
      refactoringDetailsViewProvider.affectedFiles = [
        { original: '/affected/original', refactored: '/affected/refactored' },
      ];
      refactoringDetailsViewProvider.energySaved = 0.5;
      refactoringDetailsViewProvider.targetSmell = mockSmell;
    });

    it('should apply refactoring changes successfully', async () => {
      await acceptRefactoring(
        mockContext,
        refactoringDetailsViewProvider,
        metricsDataProvider as unknown as MetricsViewProvider,
        smellsCacheManager as unknown as SmellsCacheManager,
        smellsViewProvider,
      );

      expect(fs.copyFileSync).toHaveBeenCalledTimes(2);
      expect(metricsDataProvider.updateMetrics).toHaveBeenCalled();
      expect(smellsCacheManager.clearCachedSmellsForFile).toHaveBeenCalledTimes(2);
      expect(smellsViewProvider.setStatus).toHaveBeenCalledWith(
        '/original/path',
        'outdated',
      );
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Refactoring successfully applied',
      );
    });

    it('should handle missing refactoring data', async () => {
      refactoringDetailsViewProvider.targetFile = undefined;

      await acceptRefactoring(
        mockContext,
        refactoringDetailsViewProvider,
        metricsDataProvider as unknown as MetricsViewProvider,
        smellsCacheManager as unknown as SmellsCacheManager,
        smellsViewProvider,
      );

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'No refactoring data available.',
      );
    });

    it('should handle filesystem errors', async () => {
      (fs.copyFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Filesystem error');
      });

      await acceptRefactoring(
        mockContext,
        refactoringDetailsViewProvider,
        metricsDataProvider as unknown as MetricsViewProvider,
        smellsCacheManager as unknown as SmellsCacheManager,
        smellsViewProvider,
      );

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Failed to apply refactoring. Please try again.',
      );
    });
  });

  describe('rejectRefactoring', () => {
    beforeEach(() => {
      refactoringDetailsViewProvider.targetFile = {
        original: '/original/path',
        refactored: '/refactored/path',
      };
    });

    it('should clean up after rejecting refactoring', async () => {
      await rejectRefactoring(
        mockContext,
        refactoringDetailsViewProvider,
        smellsViewProvider,
      );

      expect(smellsViewProvider.setStatus).toHaveBeenCalledWith(
        '/original/path',
        'passed',
      );
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Refactoring changes discarded',
      );
      expect(mockContext.workspaceState.update).toHaveBeenCalledWith(
        envConfig.UNFINISHED_REFACTORING!,
        undefined,
      );
    });

    it('should handle errors during cleanup', async () => {
      (smellsViewProvider.setStatus as jest.Mock).mockImplementation(() => {
        throw new Error('Status update failed');
      });

      await rejectRefactoring(
        mockContext,
        refactoringDetailsViewProvider,
        smellsViewProvider,
      );

      expect(ecoOutput.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during rejection cleanup'),
      );
    });
  });
});
