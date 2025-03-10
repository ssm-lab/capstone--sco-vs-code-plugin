import {
  checkServerStatus,
  initLogs,
  fetchSmells,
  refactorSmell,
} from '../../src/api/backend';
import { serverStatus } from '../../src/utils/serverStatus';
import { ServerStatusType } from '../../src/utils/serverStatus';
import * as vscode from '../mocks/vscode-mock';

describe('backend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('checkServerStatus should update serverStatus to UP on success', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: true })) as jest.Mock;

    const setStatusSpy = jest.spyOn(serverStatus, 'setStatus');

    await checkServerStatus();

    expect(setStatusSpy).toHaveBeenCalledWith(ServerStatusType.UP);
  });

  test('initLogs should return true on success', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: true })) as jest.Mock;
    const result = await initLogs('/path/to/logs');
    expect(result).toBe(true);
  });

  test('fetchSmells should return smells array on success', async () => {
    const mockSmells = [{ symbol: 'LongMethod', severity: 'HIGH' }];
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(mockSmells) }),
    ) as jest.Mock;
    const result = await fetchSmells('file.py', ['LongMethod']);
    expect(result).toEqual(mockSmells);
  });

  test('refactorSmell should return refactor result on success', async () => {
    const mockRefactorOutput = { success: true };

    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(mockRefactorOutput) }),
    ) as jest.Mock;

    (vscode.workspace as any).workspaceFolders = [
      { uri: { fsPath: '/mock/workspace' } },
    ];

    const result = await refactorSmell('/mock/workspace/file.py', {
      symbol: 'LongMethod',
    } as Smell);
    expect(result).toEqual(mockRefactorOutput);
  });
});
