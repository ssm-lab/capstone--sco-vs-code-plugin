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

    fileHighlighter = new FileHighlighter(contextManagerMock);
  });

  it('should create decorations', () => {
    const color = 'red';
    const decoration = fileHighlighter['getDecoration'](color);

    // Assert decoration was created
    expect(vscode.window.createTextEditorDecorationType).toHaveBeenCalled();
    expect(decoration).toBeDefined();
  });

  it('should highlight smells', () => {
    const smells = [
      {
        messageId: 'smell1',
        occurences: [{ line: 1 }],
      },
    ] as unknown as Smell[];

    jest.spyOn(HoverManager, 'getInstance').mockReturnValueOnce({
      hoverContent: 'hover content' as unknown as MarkdownString,
    } as unknown as HoverManager);

    fileHighlighter.highlightSmell(vscode.window.activeTextEditor, smells, 'R1729');

    // Assert decorations were set
    expect(vscode.window.activeTextEditor.setDecorations).toHaveBeenCalled();
  });

  it('should not reset highlight decorations on first init', () => {
    const smells = [
      {
        messageId: 'R1729',
        occurences: [{ line: 1 }],
      },
    ] as unknown as Smell[];

    jest.spyOn(HoverManager, 'getInstance').mockReturnValueOnce({
      hoverContent: 'hover content' as unknown as MarkdownString,
    } as unknown as HoverManager);

    fileHighlighter.highlightSmells(vscode.window.activeTextEditor, smells);

    // Assert decorations were set
    expect(fileHighlighter['decorations'][0].dispose).not.toHaveBeenCalled();
  });

  it('should reset highlight decorations on subsequent calls', () => {
    const smells = [
      {
        messageId: 'R1729',
        occurences: [{ line: 1 }],
      },
    ] as unknown as Smell[];

    jest.spyOn(HoverManager, 'getInstance').mockReturnValueOnce({
      hoverContent: 'hover content' as unknown as MarkdownString,
    } as unknown as HoverManager);

    fileHighlighter.highlightSmells(vscode.window.activeTextEditor, smells);

    fileHighlighter.highlightSmells(vscode.window.activeTextEditor, smells);

    // Assert decorations were set
    expect(fileHighlighter['decorations'][0].dispose).toHaveBeenCalled();
  });
});
