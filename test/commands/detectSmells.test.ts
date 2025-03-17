// test/detect-smells.test.ts
import { ContextManager } from '../../src/context/contextManager';
import { FileHighlighter } from '../../src/ui/fileHighlighter';

import vscode from '../mocks/vscode-mock';

import * as backend from '../../src/api/backend';
import * as hashDocs from '../../src/utils/hashDocs';
import * as editorUtils from '../../src/utils/editorUtils';
import * as SmellSettings from '../../src/utils/handleSmellSettings';

import { detectSmells } from '../../src/commands/detectSmells';
import { serverStatus, ServerStatusType } from '../../src/utils/serverStatus';
import { wipeWorkCache } from '../../src/commands/wipeWorkCache';

jest.mock('../../src/commands/wipeWorkCache', () => ({
  wipeWorkCache: jest.fn(),
}));

jest.mock('../../src/utils/handleSmellSettings.ts', () => ({
  getEnabledSmells: jest.fn().mockImplementation(() => ({
    smell1: true,
    smell2: true,
  })),
}));

describe('detectSmells', () => {
  let contextManagerMock: ContextManager;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock ContextManager
    contextManagerMock = {
      getWorkspaceData: jest.fn(),
      setWorkspaceData: jest.fn(),
    } as unknown as ContextManager;
  });

  it('should show an error if no active editor is found', async () => {
    jest
      .spyOn(editorUtils, 'getEditorAndFilePath')
      .mockReturnValue({ editor: undefined, filePath: undefined });

    await detectSmells(contextManagerMock);

    // Assert error message was shown
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Eco: No active editor found.',
    );
  });

  it('should show an error if no file path is found', async () => {
    jest.spyOn(editorUtils, 'getEditorAndFilePath').mockReturnValue({
      editor: vscode.window.activeTextEditor,
      filePath: undefined,
    });

    await detectSmells(contextManagerMock);

    // Assert error message was shown
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Eco: Active editor has no valid file path.',
    );
  });

  it('should show a warning if no smells are enabled', async () => {
    jest.spyOn(editorUtils, 'getEditorAndFilePath').mockReturnValueOnce({
      editor: vscode.window.activeTextEditor,
      filePath: 'fake.path',
    });

    jest
      .spyOn(SmellSettings, 'getEnabledSmells')
      .mockReturnValueOnce({ smell1: false, smell2: false });

    await detectSmells(contextManagerMock);

    // Assert warning message was shown
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      'Eco: No smells are enabled! Detection skipped.',
    );
  });

  it('should use cached smells when hash is unchanged, same smells enabled', async () => {
    jest.spyOn(editorUtils, 'getEditorAndFilePath').mockReturnValueOnce({
      editor: vscode.window.activeTextEditor,
      filePath: 'fake.path',
    });

    jest.spyOn(hashDocs, 'hashContent').mockReturnValue('someHash');

    jest
      .spyOn(contextManagerMock, 'getWorkspaceData')
      .mockReturnValueOnce({ smell1: true, smell2: true })
      .mockReturnValueOnce({
        'fake.path': {
          hash: 'someHash',
          smells: [],
        },
      });

    jest.spyOn(serverStatus, 'getStatus').mockReturnValue(ServerStatusType.UP);

    await detectSmells(contextManagerMock);

    expect(vscode.window.showInformationMessage).toHaveBeenNthCalledWith(
      1,
      'Eco: Using cached smells for fake.path',
    );
  });

  it('should fetch new smells on changed enabled smells', async () => {
    jest.spyOn(editorUtils, 'getEditorAndFilePath').mockReturnValueOnce({
      editor: vscode.window.activeTextEditor,
      filePath: 'fake.path',
    });

    jest.spyOn(hashDocs, 'hashContent').mockReturnValue('someHash');
    jest.spyOn(hashDocs, 'updateHash').mockResolvedValue();

    jest
      .spyOn(contextManagerMock, 'getWorkspaceData')
      .mockReturnValueOnce({ smell1: true, smell2: false })
      .mockReturnValueOnce({});

    jest.spyOn(backend, 'fetchSmells').mockResolvedValueOnce([]);

    jest.spyOn(serverStatus, 'getStatus').mockReturnValue(ServerStatusType.UP);

    await detectSmells(contextManagerMock);

    expect(wipeWorkCache).toHaveBeenCalled();
    expect(hashDocs.updateHash).toHaveBeenCalled();
    expect(backend.fetchSmells).toHaveBeenCalled();
    expect(contextManagerMock.setWorkspaceData).toHaveBeenCalledTimes(2);
  });

  it('should fetch new smells on hash change, same enabled smells', async () => {
    jest.spyOn(editorUtils, 'getEditorAndFilePath').mockReturnValueOnce({
      editor: vscode.window.activeTextEditor,
      filePath: 'fake.path',
    });

    jest.spyOn(hashDocs, 'hashContent').mockReturnValue('someHash');
    jest.spyOn(hashDocs, 'updateHash').mockResolvedValue();

    jest
      .spyOn(contextManagerMock, 'getWorkspaceData')
      .mockReturnValueOnce({ smell1: true, smell2: true })
      .mockReturnValueOnce({
        'fake.path': {
          hash: 'differentHash',
          smells: [],
        },
      });

    jest.spyOn(serverStatus, 'getStatus').mockReturnValue(ServerStatusType.UP);

    jest.spyOn(backend, 'fetchSmells').mockResolvedValueOnce([]);

    await detectSmells(contextManagerMock);

    expect(hashDocs.updateHash).toHaveBeenCalled();
    expect(backend.fetchSmells).toHaveBeenCalled();
    expect(contextManagerMock.setWorkspaceData).toHaveBeenCalledTimes(1);
  });

  it('should return if no cached smells and server down', async () => {
    jest.spyOn(editorUtils, 'getEditorAndFilePath').mockReturnValueOnce({
      editor: vscode.window.activeTextEditor,
      filePath: 'fake.path',
    });

    jest.spyOn(hashDocs, 'hashContent').mockReturnValue('someHash');
    jest.spyOn(hashDocs, 'updateHash').mockResolvedValue();

    jest
      .spyOn(contextManagerMock, 'getWorkspaceData')
      .mockReturnValueOnce({ smell1: true, smell2: true })
      .mockReturnValueOnce({});

    jest.spyOn(serverStatus, 'getStatus').mockReturnValue(ServerStatusType.DOWN);

    await detectSmells(contextManagerMock);

    expect(vscode.window.showWarningMessage).toHaveBeenLastCalledWith(
      'Action blocked: Server is down and no cached smells exist for this file version.',
    );
  });

  it('should highlight smells if smells are found', async () => {
    jest.spyOn(editorUtils, 'getEditorAndFilePath').mockReturnValueOnce({
      editor: vscode.window.activeTextEditor,
      filePath: 'fake.path',
    });

    jest.spyOn(hashDocs, 'hashContent').mockReturnValue('someHash');

    jest
      .spyOn(contextManagerMock, 'getWorkspaceData')
      .mockReturnValueOnce({ smell1: true, smell2: true })
      .mockReturnValueOnce({
        'fake.path': {
          hash: 'someHash',
          smells: [{} as unknown as Smell],
        },
      });

    jest.spyOn(serverStatus, 'getStatus').mockReturnValue(ServerStatusType.UP);

    const mockHighlightSmells = jest.fn();
    jest
      .spyOn(FileHighlighter.prototype, 'highlightSmells')
      .mockImplementation(mockHighlightSmells);

    await detectSmells(contextManagerMock);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledTimes(2);
    expect(vscode.window.showInformationMessage).toHaveBeenNthCalledWith(
      1,
      'Eco: Using cached smells for fake.path',
    );

    expect(vscode.window.showInformationMessage).toHaveBeenNthCalledWith(
      2,
      'Eco: Highlighted 1 smells.',
    );

    expect(mockHighlightSmells).toHaveBeenCalled();
  });
});
