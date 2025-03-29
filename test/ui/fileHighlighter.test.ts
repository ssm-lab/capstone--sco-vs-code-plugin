// test/fileHighlighter.test.ts
import * as vscode from 'vscode';
import { FileHighlighter } from '../../src/ui/fileHighlighter';
import { SmellsCacheManager } from '../../src/context/SmellsCacheManager';
import { ConfigManager } from '../../src/context/configManager';
import * as smellsData from '../../src/utils/smellsData';

// Mock dependencies
jest.mock('vscode');
jest.mock('../../src/context/SmellsCacheManager');
jest.mock('../../src/context/configManager');
jest.mock('../../src/utils/smellsData');

describe('FileHighlighter', () => {
  let smellsCacheManager: { getCachedSmells: jest.Mock; onSmellsUpdated: jest.Mock };
  let fileHighlighter: FileHighlighter;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock instances
    smellsCacheManager = {
      getCachedSmells: jest.fn(),
      onSmellsUpdated: jest.fn(),
    };
    FileHighlighter['instance'] = undefined;
    fileHighlighter = FileHighlighter.getInstance(
      smellsCacheManager as unknown as SmellsCacheManager,
    );

    // Mock ConfigManager
    (ConfigManager.get as jest.Mock).mockImplementation((key: string) => {
      switch (key) {
        case 'smellsColours':
          return { smell1: 'rgba(255,0,0,0.5)', smell2: 'rgba(0,0,255,0.5)' };
        case 'useSingleColour':
          return false;
        case 'singleHighlightColour':
          return 'rgba(255,204,0,0.5)';
        case 'highlightStyle':
          return 'underline';
        default:
          return undefined;
      }
    });

    // Mock createTextEditorDecorationType
    (vscode.window.createTextEditorDecorationType as jest.Mock).mockImplementation(
      () => ({
        dispose: jest.fn(),
      }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Cleans up all spy mocks
    (vscode.window.createTextEditorDecorationType as jest.Mock).mockClear();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = FileHighlighter.getInstance(
        smellsCacheManager as unknown as SmellsCacheManager,
      );
      const instance2 = FileHighlighter.getInstance(
        smellsCacheManager as unknown as SmellsCacheManager,
      );
      expect(instance1).toBe(instance2);
    });
  });

  describe('updateHighlightsForVisibleEditors', () => {
    it('should call highlightSmells for each visible Python editor', () => {
      // Mock highlightSmells to track calls
      const highlightSpy = jest.spyOn(fileHighlighter, 'highlightSmells');

      // Create a non-Python editor
      const nonPythonEditor = {
        document: {
          fileName: '/path/to/file.js',
          uri: { fsPath: '/path/to/file.js' },
        },
      } as unknown as vscode.TextEditor;

      vscode.window.visibleTextEditors = [
        nonPythonEditor,
        vscode.window.activeTextEditor!,
      ];

      fileHighlighter.updateHighlightsForVisibleEditors();

      // Verify highlightSmells was called exactly once (for the Python editor)
      expect(highlightSpy).toHaveBeenCalledTimes(1);

      // Clean up spy
      highlightSpy.mockRestore();
    });
  });

  describe('updateHighlightsForFile', () => {
    it('should call highlightSmells when matching Python file is visible', () => {
      const highlightSpy = jest.spyOn(fileHighlighter, 'highlightSmells');

      vscode.window.visibleTextEditors = [vscode.window.activeTextEditor!];

      fileHighlighter['updateHighlightsForFile']('fake.py');

      expect(highlightSpy).toHaveBeenCalledTimes(1);
      highlightSpy.mockRestore();
    });

    it('should not call highlightSmells for non-matching files', () => {
      const highlightSpy = jest.spyOn(fileHighlighter, 'highlightSmells');

      fileHighlighter['updateHighlightsForFile']('/path/to/other.py');

      expect(highlightSpy).not.toHaveBeenCalled();
      highlightSpy.mockRestore();
    });

    it('should not call highlightSmells for non-Python files', () => {
      const highlightSpy = jest.spyOn(fileHighlighter, 'highlightSmells');

      fileHighlighter['updateHighlightsForFile']('/path/to/file.js');

      expect(highlightSpy).not.toHaveBeenCalled();
      highlightSpy.mockRestore();
    });
  });

  describe('highlightSmells', () => {
    const mockEditor = vscode.window.activeTextEditor;
    it('should highlight smells when cache has data', () => {
      const mockSmells = [
        {
          symbol: 'smell1',
          occurences: [{ line: 1 }, { line: 2 }],
        },
        {
          symbol: 'smell2',
          occurences: [{ line: 3 }],
        },
      ] as unknown as Smell[];

      jest.spyOn(smellsData, 'getEnabledSmells').mockReturnValueOnce({
        smell1: {} as any,
        smell2: {} as any,
      });

      (smellsCacheManager.getCachedSmells as jest.Mock).mockReturnValueOnce(
        mockSmells,
      );

      console.log(
        'Mock getCachedSmells implementation:',
        smellsCacheManager.getCachedSmells.mock.results,
      );

      const editor = vscode.window.activeTextEditor;

      fileHighlighter.highlightSmells(editor!);

      expect(vscode.window.createTextEditorDecorationType).toHaveBeenCalledTimes(2);
      expect(editor!.setDecorations).toHaveBeenCalledTimes(2);
    });

    it('should not highlight when cache has no data', () => {
      smellsCacheManager.getCachedSmells.mockReturnValueOnce(undefined);
      fileHighlighter.highlightSmells(mockEditor!);
      expect(mockEditor!.setDecorations).not.toHaveBeenCalled();
    });

    it('should only highlight enabled smells', () => {
      jest.spyOn(smellsData, 'getEnabledSmells').mockReturnValueOnce({
        smell1: {} as any,
      });

      const mockSmells = [
        {
          symbol: 'smell1',
          occurences: [{ line: 1 }],
        },
        {
          symbol: 'smell2',
          occurences: [{ line: 2 }],
        },
      ];

      smellsCacheManager.getCachedSmells.mockReturnValueOnce(mockSmells);

      fileHighlighter.highlightSmells(mockEditor!);

      expect(
        (mockEditor?.setDecorations as jest.Mock).mock.calls[0][1],
      ).toHaveLength(1);
    });

    it('should skip invalid line numbers', () => {
      const mockSmells = [
        {
          symbol: 'smell1',
          occurences: [{ line: 100 }], // Invalid line number
        },
      ];

      jest.spyOn(smellsData, 'getEnabledSmells').mockReturnValueOnce({
        smell1: {} as any,
        smell2: {} as any,
      });

      smellsCacheManager.getCachedSmells.mockReturnValueOnce(mockSmells);

      fileHighlighter.highlightSmells(mockEditor!);

      expect(mockEditor?.setDecorations).toHaveBeenCalledWith(expect.anything(), []);
    });
  });

  describe('resetHighlights', () => {
    it('should dispose all decorations', () => {
      const mockEditor = vscode.window.activeTextEditor;
      const mockDecoration = { dispose: jest.fn() };
      (
        vscode.window.createTextEditorDecorationType as jest.Mock
      ).mockReturnValueOnce(mockDecoration);

      jest.spyOn(smellsData, 'getEnabledSmells').mockReturnValueOnce({
        smell1: {} as any,
        smell2: {} as any,
      });

      const mockSmells = [{ symbol: 'smell1', occurences: [{ line: 1 }] }];
      smellsCacheManager.getCachedSmells.mockReturnValueOnce(mockSmells);

      fileHighlighter.highlightSmells(mockEditor!);
      fileHighlighter.resetHighlights();

      expect(mockDecoration.dispose).toHaveBeenCalled();
      expect(fileHighlighter['decorations']).toHaveLength(0);
    });
  });

  describe('getDecoration', () => {
    it('should create underline decoration', () => {
      (ConfigManager.get as jest.Mock).mockImplementation((key: string) =>
        key === 'highlightStyle' ? 'underline' : undefined,
      );

      expect(vscode.window.createTextEditorDecorationType).toHaveBeenCalledWith({
        textDecoration: 'wavy rgba(255,0,0,0.5) underline 1px',
      });
    });

    it('should create flashlight decoration', () => {
      (ConfigManager.get as jest.Mock).mockImplementation((key: string) =>
        key === 'highlightStyle' ? 'flashlight' : undefined,
      );

      fileHighlighter['getDecoration']('rgba(255,0,0,0.5)', 'flashlight');
      expect(vscode.window.createTextEditorDecorationType).toHaveBeenCalledWith({
        isWholeLine: true,
        backgroundColor: 'rgba(255,0,0,0.5)',
      });
    });

    it('should create border-arrow decoration', () => {
      (ConfigManager.get as jest.Mock).mockImplementation((key: string) =>
        key === 'highlightStyle' ? 'border-arrow' : undefined,
      );

      fileHighlighter['getDecoration']('rgba(255,0,0,0.5)', 'border-arrow');
      expect(vscode.window.createTextEditorDecorationType).toHaveBeenCalledWith({
        borderWidth: '1px 2px 1px 0',
        borderStyle: 'solid',
        borderColor: 'rgba(255,0,0,0.5)',
        after: {
          contentText: '▶',
          margin: '0 0 0 5px',
          color: 'rgba(255,0,0,0.5)',
          fontWeight: 'bold',
        },
        overviewRulerColor: 'rgba(255,0,0,0.5)',
        overviewRulerLane: vscode.OverviewRulerLane.Right,
      });
    });

    it('should default to underline for unknown styles', () => {
      fileHighlighter['getDecoration']('rgba(255,0,0,0.5)', 'unknown');
      expect(vscode.window.createTextEditorDecorationType).toHaveBeenCalledWith({
        textDecoration: 'wavy rgba(255,0,0,0.5) underline 1px',
      });
    });
  });
});
