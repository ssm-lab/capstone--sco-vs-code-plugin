import * as vscode from 'vscode';
import { ContextManager } from '../../src/context/contextManager';
import { toggleSmellLinting } from '../../src/commands/toggleSmellLinting';
import { FileHighlighter } from '../../src/ui/fileHighlighter';
import { detectSmells } from '../../src/commands/detectSmells';
import { envConfig } from '../../src/utils/envConfig';

jest.mock('../../src/commands/detectSmells', () => ({
  detectSmells: jest.fn(),
}));

jest.mock('../../src/ui/fileHighlighter', () => ({
  FileHighlighter: {
    getInstance: jest.fn(),
  },
}));

describe('toggleSmellLinting', () => {
  let contextManagerMock: ContextManager;
  let fileHighlighterMock: FileHighlighter;

  beforeEach(() => {
    jest.clearAllMocks();

    contextManagerMock = {
      getWorkspaceData: jest.fn(),
      setWorkspaceData: jest.fn(),
    } as unknown as ContextManager;

    fileHighlighterMock = {
      resetHighlights: jest.fn(),
    } as unknown as FileHighlighter;

    (FileHighlighter.getInstance as jest.Mock).mockReturnValue(fileHighlighterMock);
  });

  it('should toggle from disabled to enabled state', async () => {
    (contextManagerMock.getWorkspaceData as jest.Mock).mockReturnValue(false);

    await toggleSmellLinting(contextManagerMock);

    expect(detectSmells).toHaveBeenCalledWith(contextManagerMock);

    expect(contextManagerMock.setWorkspaceData).toHaveBeenCalledWith(
      envConfig.SMELL_LINTING_ENABLED_KEY,
      true,
    );

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'setContext',
      'eco.smellLintingEnabled',
      true,
    );
  });

  it('should toggle from enabled to disabled state', async () => {
    (contextManagerMock.getWorkspaceData as jest.Mock).mockReturnValue(true);

    await toggleSmellLinting(contextManagerMock);

    expect(fileHighlighterMock.resetHighlights).toHaveBeenCalled();

    expect(contextManagerMock.setWorkspaceData).toHaveBeenCalledWith(
      envConfig.SMELL_LINTING_ENABLED_KEY,
      false,
    );

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'setContext',
      'eco.smellLintingEnabled',
      false,
    );

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Eco: Smell linting turned off.',
    );
  });

  it('should handle errors and revert UI state', async () => {
    (contextManagerMock.getWorkspaceData as jest.Mock).mockReturnValue(false);

    (detectSmells as jest.Mock).mockRejectedValue(new Error('Test error'));

    await toggleSmellLinting(contextManagerMock);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Eco: Failed to toggle smell linting.',
    );

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'setContext',
      'eco.smellLintingEnabled',
      false,
    );
  });
});
