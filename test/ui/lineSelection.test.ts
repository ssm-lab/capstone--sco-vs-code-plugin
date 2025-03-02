// test/line-selection-manager.test.ts
import { LineSelectionManager } from '../../src/ui/lineSelectionManager';
import { ContextManager } from '../../src/context/contextManager';
import vscode from 'vscode';

jest.mock('vscode');

jest.mock('../../src/utils/hashDocs', () => ({
  hashContent: jest.fn(() => 'mockHash'),
}));

describe('LineSelectionManager', () => {
  let contextManagerMock: ContextManager;
  let mockEditor: vscode.TextEditor;
  let lineSelectionManager: LineSelectionManager;

  beforeEach(() => {
    jest.clearAllMocks();

    contextManagerMock = {
      getWorkspaceData: jest.fn(() => ({
        '/test/file.py': {
          hash: 'mockHash',
          smells: [
            { symbol: 'PERF-001', occurences: [{ line: 5 }] },
            { symbol: 'SEC-002', occurences: [{ line: 5 }] },
          ],
        },
      })),
    } as unknown as ContextManager;

    mockEditor = {
      document: {
        fileName: '/test/file.py',
        getText: jest.fn(() => 'mock content'),
        lineAt: jest.fn((line) => ({ text: 'mock line content' })),
      },
      selection: {
        start: { line: 4 }, // 0-based index, maps to line 5
        isSingleLine: true,
      } as any,
      setDecorations: jest.fn(),
    } as unknown as vscode.TextEditor;

    lineSelectionManager = new LineSelectionManager(contextManagerMock);
  });

  it('should remove last comment if decoration exists', () => {
    const disposeMock = jest.fn();
    (lineSelectionManager as any).decoration = { dispose: disposeMock };

    lineSelectionManager.removeLastComment();
    expect(disposeMock).toHaveBeenCalled();
  });

  it('should not proceed if no editor is provided', () => {
    expect(() => lineSelectionManager.commentLine(null as any)).not.toThrow();
  });

  it('should not add comment if no smells detected for file', () => {
    (contextManagerMock.getWorkspaceData as jest.Mock).mockReturnValue({});
    lineSelectionManager.commentLine(mockEditor);
    expect(mockEditor.setDecorations).not.toHaveBeenCalled();
  });

  it('should not add comment if document hash does not match', () => {
    (contextManagerMock.getWorkspaceData as jest.Mock).mockReturnValue({
      '/test/file.py': { hash: 'differentHash', smells: [] },
    });
    lineSelectionManager.commentLine(mockEditor);
    expect(mockEditor.setDecorations).not.toHaveBeenCalled();
  });

  it('should add a single-line comment if a smell is found', () => {
    lineSelectionManager.commentLine(mockEditor);

    expect(mockEditor.setDecorations).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Array),
    );
  });

  it('should display a combined comment if multiple smells exist', () => {
    lineSelectionManager.commentLine(mockEditor);

    const expectedComment = '🍂 Smell: PERF-001 | (+1)';
    expect(mockEditor.setDecorations).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({ contentText: expectedComment }),
      }),
      expect.any(Array),
    );
  });
});

// Mock updates for test/mocks/vscode-mock.ts
export const mockVscode = {
  window: {
    createTextEditorDecorationType: jest.fn(() => ({ dispose: jest.fn() })),
  },
  Range: jest.fn((startLine, startChar, endLine, endChar) => ({
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar },
  })),
};

jest.mock('vscode', () => mockVscode);
