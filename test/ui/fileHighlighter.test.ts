import { FileHighlighter } from '../../src/ui/fileHighlighter';
import { ContextManager } from '../../src/context/contextManager';
import vscode from '../mocks/vscode-mock';
import { HoverManager } from '../../src/ui/hoverManager';
import { MarkdownString } from 'vscode';

jest.mock('vscode');

describe('File Highlighter', () => {
  let contextManagerMock: ContextManager;
  let fileHighlighter: FileHighlighter;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock ContextManager
    contextManagerMock = {
      getWorkspaceData: jest.fn(),
      setWorkspaceData: jest.fn(),
    } as unknown as ContextManager;

    fileHighlighter = FileHighlighter.getInstance(contextManagerMock);
  });

  it('should not reset highlight decorations on first init', () => {
    const smells = [
      {
        symbol: 'smell1',
        occurences: [{ line: 1 }],
      },
    ] as unknown as Smell[];
    const currentConfig = {
      smell1: {
        enabled: true,
        colour: 'rgba(1, 50, 0, 0.5)',
      },
    };

    jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValueOnce({
      get: jest.fn().mockReturnValue(currentConfig),
    } as any);

    jest.spyOn(HoverManager, 'getInstance').mockReturnValueOnce({
      hoverContent: 'hover content' as unknown as MarkdownString,
    } as unknown as HoverManager);

    fileHighlighter.highlightSmells(vscode.window.activeTextEditor, smells);

    // Assert decorations were set
    expect(fileHighlighter['decorations'][0].dispose).not.toHaveBeenCalled();
  });

  it('should create decorations', () => {
    const color = 'red';
    const decoration = fileHighlighter['getDecoration'](color, 'underline');

    // Assert decoration was created
    expect(vscode.window.createTextEditorDecorationType).toHaveBeenCalled();
    expect(decoration).toBeDefined();
  });

  it('should highlight smells', () => {
    const smells = [
      {
        symbol: 'smell1',
        occurences: [{ line: 1 }],
      },
    ] as unknown as Smell[];
    const currentConfig = {
      smell1: {
        enabled: true,
        colour: 'rgba(88, 101, 200, 0.5)',
      },
    };

    jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValueOnce({
      get: jest.fn().mockReturnValue(currentConfig),
    } as any);

    jest.spyOn(HoverManager, 'getInstance').mockReturnValueOnce({
      hoverContent: 'hover content' as unknown as MarkdownString,
    } as unknown as HoverManager);

    fileHighlighter.highlightSmells(vscode.window.activeTextEditor, smells);

    expect(vscode.window.activeTextEditor.setDecorations).toHaveBeenCalled();
    expect(
      vscode.window.activeTextEditor.setDecorations.mock.calls[0][1],
    ).toHaveLength(1);
  });

  it('should reset highlight decorations on subsequent calls', () => {
    const smells = [
      {
        symbol: 'smell1',
        occurences: [{ line: 1 }],
      },
    ] as unknown as Smell[];
    const currentConfig = {
      smell1: {
        enabled: true,
        colour: 'rgba(255, 204, 0, 0.5)',
      },
    };

    jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: jest.fn().mockReturnValue(currentConfig),
    } as any);

    jest.spyOn(HoverManager, 'getInstance').mockReturnValue({
      hoverContent: 'hover content' as unknown as MarkdownString,
    } as unknown as HoverManager);

    fileHighlighter.highlightSmells(vscode.window.activeTextEditor, smells);

    fileHighlighter.highlightSmells(vscode.window.activeTextEditor, smells);

    // Assert decorations were set
    expect(fileHighlighter['decorations'][0].dispose).toHaveBeenCalled();
  });
});
