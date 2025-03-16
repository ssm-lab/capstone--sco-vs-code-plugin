import * as vscode from 'vscode';
import { refactorSelectedSmell } from '../../src/commands/refactorSmell';
import { ContextManager } from '../../src/context/contextManager';
import { refactorSmell } from '../../src/api/backend';
import { FileHighlighter } from '../../src/ui/fileHighlighter';
import { envConfig } from '../../src/utils/envConfig';
import { Smell } from '../../src/types';

// mock VSCode APIs
jest.mock('vscode', () => ({
  window: {
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    withProgress: jest.fn((options, task) => task()),
    activeTextEditor: undefined,
    showTextDocument: jest.fn().mockResolvedValue(undefined),
  },
  workspace: {
    save: jest.fn(),
    getConfiguration: jest.fn(),
    openTextDocument: jest.fn().mockImplementation(async (uri) => ({
      // Mock TextDocument object
      uri: typeof uri === 'string' ? { fsPath: uri } : uri,
      fileName: typeof uri === 'string' ? uri : uri.fsPath,
      getText: jest.fn().mockReturnValue('mock content'),
    })),
  },
  ProgressLocation: {
    Notification: 1,
  },
  Uri: {
    file: jest.fn((path) => ({
      toString: () => `file://${path}`,
      fsPath: path,
    })),
  },
  commands: {
    executeCommand: jest.fn(),
  },
  ViewColumn: {
    Beside: 2,
  },
}));

// mock backend API
jest.mock('../../src/api/backend', () => ({
  refactorSmell: jest.fn(),
}));

// mock FileHighlighter
jest.mock('../../src/ui/fileHighlighter', () => ({
  FileHighlighter: jest.fn().mockImplementation(() => ({
    highlightSmells: jest.fn(),
  })),
}));

// mock setTimeout
jest.mock('timers/promises', () => ({
  setTimeout: jest.fn().mockResolvedValue(undefined),
}));

describe('refactorSelectedSmell', () => {
  let mockContextManager: jest.Mocked<ContextManager>;
  let mockEditor: any;
  let mockDocument: any;
  let mockSelection: any;

  const createMockSmell = (line: number): Smell => ({
    messageId: 'R0913',
    type: 'refactor',
    message: 'Too many arguments (8/6)',
    confidence: 'HIGH',
    path: 'fake.py',
    symbol: 'too-many-arguments',
    module: 'test-module',
    occurences: [
      {
        line,
        column: 1,
      },
    ],
    additionalInfo: {},
  });

  beforeEach(() => {
    // reset all mocks
    jest.clearAllMocks();

    // setup mock context manager
    mockContextManager = {
      getWorkspaceData: jest.fn(),
      setWorkspaceData: jest.fn(),
    } as any;

    // setup mock selection
    mockSelection = {
      start: { line: 0 }, // Line 1 in VS Code's 0-based indexing
      end: { line: 0 },
    };

    // setup mock document
    mockDocument = {
      getText: jest.fn().mockReturnValue('mock content'),
      uri: { fsPath: '/test/file.ts' },
    };

    // setup mock editor
    mockEditor = {
      document: mockDocument,
      selection: mockSelection,
    };

    // reset vscode.window.activeTextEditor
    (vscode.window as any).activeTextEditor = mockEditor;

    // reset commands mock
    (vscode.commands.executeCommand as jest.Mock).mockResolvedValue(undefined);
  });

  test('should show error when no active editor', async () => {
    (vscode.window as any).activeTextEditor = undefined;

    await refactorSelectedSmell(mockContextManager, false);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Eco: Unable to proceed as no active editor or file path found.',
    );
  });

  test('should show error when no smells detected', async () => {
    mockContextManager.getWorkspaceData.mockImplementation((key) => {
      if (key === envConfig.SMELL_MAP_KEY) {
        return {
          '/test/file.ts': {
            smells: [],
          },
        };
      }
      return null;
    });

    await refactorSelectedSmell(mockContextManager, false);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Eco: No smells detected in the file for refactoring.',
    );
  });

  test('should show error when no matching smell found for selected line', async () => {
    const mockSmells = [createMockSmell(5)];

    mockContextManager.getWorkspaceData.mockImplementation((key) => {
      if (key === envConfig.SMELL_MAP_KEY) {
        return {
          '/test/file.ts': {
            smells: mockSmells,
          },
        };
      }
      return null;
    });

    await refactorSelectedSmell(mockContextManager, false);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Eco: No matching smell found for refactoring.',
    );
  });

  test('should successfully refactor a smell when found', async () => {
    const mockSmells = [createMockSmell(1)];

    const mockRefactorResult = {
      refactoredData: {
        tempDir: '/tmp/test',
        targetFile: {
          original: '/test/file.ts',
          refactored: '/test/file.refactored.ts',
        },
        affectedFiles: [
          {
            original: '/test/other.ts',
            refactored: '/test/other.refactored.ts',
          },
        ],
        energySaved: 10,
      },
      updatedSmells: [
        {
          ...createMockSmell(1),
          messageId: 'updated-smell',
          symbol: 'UpdatedSmell',
          message: 'Updated message',
        },
      ],
    };

    mockContextManager.getWorkspaceData.mockImplementation((key) => {
      if (key === envConfig.SMELL_MAP_KEY) {
        return {
          '/test/file.ts': {
            smells: mockSmells,
          },
        };
      }
      return null;
    });

    (refactorSmell as jest.Mock).mockResolvedValue(mockRefactorResult);

    await refactorSelectedSmell(mockContextManager, false);

    expect(vscode.workspace.save).toHaveBeenCalled();
    expect(refactorSmell).toHaveBeenCalledWith('/test/file.ts', mockSmells[0]);
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Refactoring report available in sidebar.',
    );
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'extension.refactorSidebar.focus',
    );
    expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
    expect(vscode.window.showTextDocument).toHaveBeenCalled();
    expect(FileHighlighter).toHaveBeenCalled();
  });

  test('should handle refactoring failure', async () => {
    const mockSmells = [createMockSmell(1)];

    mockContextManager.getWorkspaceData.mockImplementation((key) => {
      if (key === envConfig.SMELL_MAP_KEY) {
        return {
          '/test/file.ts': {
            smells: mockSmells,
          },
        };
      }
      return null;
    });

    (refactorSmell as jest.Mock).mockRejectedValue(new Error('Refactoring failed'));

    await refactorSelectedSmell(mockContextManager, false);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Eco: Refactoring failed. See console for details.',
    );
  });

  test('should handle given smell parameter', async () => {
    const givenSmell = createMockSmell(3);
    const mockSmells = [givenSmell];

    mockContextManager.getWorkspaceData.mockImplementation((key) => {
      if (key === envConfig.SMELL_MAP_KEY) {
        return {
          '/test/file.ts': {
            smells: mockSmells,
          },
        };
      }
      return null;
    });

    const mockRefactorResult = {
      refactoredData: {
        tempDir: '/tmp/test',
        targetFile: {
          original: '/test/file.ts',
          refactored: '/test/file.refactored.ts',
        },
        affectedFiles: [
          {
            original: '/test/other.ts',
            refactored: '/test/other.refactored.ts',
          },
        ],
        energySaved: 10,
      },
      updatedSmells: [],
    };

    (refactorSmell as jest.Mock).mockResolvedValue(mockRefactorResult);

    await refactorSelectedSmell(mockContextManager, false, givenSmell);

    expect(refactorSmell).toHaveBeenCalledWith('/test/file.ts', givenSmell);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'extension.refactorSidebar.focus',
    );
    expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
    expect(vscode.window.showTextDocument).toHaveBeenCalled();
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      'Eco: No updated smells detected after refactoring.',
    );
  });
});
