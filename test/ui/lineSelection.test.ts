import * as vscode from 'vscode';
import { LineSelectionManager } from '../../src/ui/lineSelectionManager';
import { SmellsCacheManager } from '../../src/context/SmellsCacheManager';

jest.mock('vscode', () => {
  const actualVscode = jest.requireActual('vscode');
  return {
    ...actualVscode,
    window: {
      ...actualVscode.window,
      createTextEditorDecorationType: jest.fn(),
      activeTextEditor: undefined,
    },
    ThemeColor: jest.fn((colorName: string) => ({ id: colorName })),
  };
});

describe('LineSelectionManager', () => {
  let manager: LineSelectionManager;
  let mockSmellsCacheManager: jest.Mocked<SmellsCacheManager>;
  let mockEditor: vscode.TextEditor;
  let mockDocument: vscode.TextDocument;
  let mockDecorationType: vscode.TextEditorDecorationType;

  // Helper function to create a mock smell
  const createMockSmell = (symbol: string, line: number) => ({
    type: 'performance',
    symbol,
    message: 'Test smell',
    messageId: 'test-smell',
    confidence: 'HIGH',
    path: '/test/file.js',
    module: 'test',
    occurences: [
      {
        line,
        column: 1,
        endLine: line,
        endColumn: 10,
      },
    ],
    additionalInfo: {},
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockSmellsCacheManager = {
      onSmellsUpdated: jest.fn(),
      getCachedSmells: jest.fn(),
    } as unknown as jest.Mocked<SmellsCacheManager>;

    mockDocument = {
      fileName: '/test/file.js',
      lineAt: jest.fn().mockReturnValue({
        text: 'const test = true;',
        trimEnd: jest.fn().mockReturnValue('const test = true;'),
      }),
      uri: {
        fsPath: '/test/file.js',
      },
    } as unknown as vscode.TextDocument;

    mockEditor = {
      document: mockDocument,
      selection: {
        isSingleLine: true,
        start: { line: 5 },
      },
      setDecorations: jest.fn(),
    } as unknown as vscode.TextEditor;

    mockDecorationType = {
      dispose: jest.fn(),
    } as unknown as vscode.TextEditorDecorationType;

    (vscode.window.createTextEditorDecorationType as jest.Mock).mockReturnValue(
      mockDecorationType,
    );

    (vscode.window.activeTextEditor as unknown) = mockEditor;

    manager = new LineSelectionManager(mockSmellsCacheManager);
  });

  describe('constructor', () => {
    it('should initialize with empty decoration and null lastDecoratedLine', () => {
      expect((manager as any).decoration).toBeNull();
      expect((manager as any).lastDecoratedLine).toBeNull();
    });

    it('should register smellsUpdated callback', () => {
      expect(mockSmellsCacheManager.onSmellsUpdated).toHaveBeenCalled();
    });
  });

  describe('removeLastComment', () => {
    it('should dispose decoration if it exists', () => {
      (manager as any).decoration = mockDecorationType;
      (manager as any).lastDecoratedLine = 5;

      manager.removeLastComment();

      expect(mockDecorationType.dispose).toHaveBeenCalled();
      expect((manager as any).decoration).toBeNull();
      expect((manager as any).lastDecoratedLine).toBeNull();
    });

    it('should do nothing if no decoration exists', () => {
      manager.removeLastComment();
      expect(mockDecorationType.dispose).not.toHaveBeenCalled();
    });
  });

  describe('commentLine', () => {
    it('should do nothing if no editor is provided', () => {
      manager.commentLine(null as any);
      expect(vscode.window.createTextEditorDecorationType).not.toHaveBeenCalled();
    });

    it('should do nothing if selection is multi-line', () => {
      (mockEditor.selection as any).isSingleLine = false;
      manager.commentLine(mockEditor);
      expect(vscode.window.createTextEditorDecorationType).not.toHaveBeenCalled();
    });

    it('should remove last comment if no smells are cached', () => {
      mockSmellsCacheManager.getCachedSmells.mockReturnValue(undefined);
      const removeSpy = jest.spyOn(manager, 'removeLastComment');

      manager.commentLine(mockEditor);

      expect(removeSpy).toHaveBeenCalled();
      expect(vscode.window.createTextEditorDecorationType).not.toHaveBeenCalled();
    });

    it('should do nothing if no smells exist at selected line', () => {
      mockSmellsCacheManager.getCachedSmells.mockReturnValue([
        createMockSmell('LongMethod', 10), // Different line
      ]);

      manager.commentLine(mockEditor);

      expect(vscode.window.createTextEditorDecorationType).not.toHaveBeenCalled();
    });

    it('should create decoration for single smell at line', () => {
      mockSmellsCacheManager.getCachedSmells.mockReturnValue([
        createMockSmell('LongMethod', 6), // line + 1
      ]);

      manager.commentLine(mockEditor);

      expect(vscode.window.createTextEditorDecorationType).toHaveBeenCalled();
      expect(mockEditor.setDecorations).toHaveBeenCalledWith(
        mockDecorationType,
        expect.any(Array),
      );
      expect((manager as any).lastDecoratedLine).toBe(5);

      const decorationConfig = (
        vscode.window.createTextEditorDecorationType as jest.Mock
      ).mock.calls[0][0];
      expect(decorationConfig.after.contentText).toBe('🍂 Smell: LongMethod');
    });

    it('should create decoration with count for multiple smells at line', () => {
      mockSmellsCacheManager.getCachedSmells.mockReturnValue([
        createMockSmell('LongMethod', 6),
        createMockSmell('ComplexCondition', 6),
      ]);

      manager.commentLine(mockEditor);

      const decorationConfig = (
        vscode.window.createTextEditorDecorationType as jest.Mock
      ).mock.calls[0][0];
      expect(decorationConfig.after.contentText).toContain(
        '🍂 Smell: LongMethod | (+1)',
      );
    });

    it('should not create decoration if same line is already decorated', () => {
      (manager as any).lastDecoratedLine = 5;
      mockSmellsCacheManager.getCachedSmells.mockReturnValue([
        createMockSmell('LongMethod', 6),
      ]);

      manager.commentLine(mockEditor);

      expect(vscode.window.createTextEditorDecorationType).not.toHaveBeenCalled();
    });
  });

  describe('smellsUpdated callback', () => {
    let smellsUpdatedCallback: (targetFilePath: string) => void;

    beforeEach(() => {
      smellsUpdatedCallback = (mockSmellsCacheManager.onSmellsUpdated as jest.Mock)
        .mock.calls[0][0];
    });

    it('should remove comment when cache is cleared for all files', () => {
      const removeSpy = jest.spyOn(manager, 'removeLastComment');
      smellsUpdatedCallback('all');
      expect(removeSpy).toHaveBeenCalled();
    });

    it('should remove comment when cache is cleared for current file', () => {
      const removeSpy = jest.spyOn(manager, 'removeLastComment');
      smellsUpdatedCallback('/test/file.js');
      expect(removeSpy).toHaveBeenCalled();
    });

    it('should not remove comment when cache is cleared for different file', () => {
      const removeSpy = jest.spyOn(manager, 'removeLastComment');
      smellsUpdatedCallback('/other/file.js');
      expect(removeSpy).not.toHaveBeenCalled();
    });
  });
});
