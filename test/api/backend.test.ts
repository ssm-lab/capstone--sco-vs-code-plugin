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

  describe('checkServerStatus', () => {
    test('checkServerStatus should update serverStatus to UP on success', async () => {
      global.fetch = jest.fn(() => Promise.resolve({ ok: true })) as jest.Mock;

      const setStatusSpy = jest.spyOn(serverStatus, 'setStatus');

      await checkServerStatus();

      expect(setStatusSpy).toHaveBeenCalledWith(ServerStatusType.UP);
    });

    test('checkServerStatus should update serverStatus to DOWN on non-success', async () => {
      global.fetch = jest.fn(() => Promise.resolve({ ok: false })) as jest.Mock;

      const setStatusSpy = jest.spyOn(serverStatus, 'setStatus');

      await checkServerStatus();

      expect(setStatusSpy).toHaveBeenCalledWith(ServerStatusType.DOWN);
    });

    test('checkServerStatus should update serverStatus to DOWN on error', async () => {
      global.fetch = jest.fn(() =>
        Promise.reject("Can't connect to server"),
      ) as jest.Mock;

      const setStatusSpy = jest.spyOn(serverStatus, 'setStatus');

      await checkServerStatus();

      expect(setStatusSpy).toHaveBeenCalledWith(ServerStatusType.DOWN);
    });
  });

  describe('initLogs', () => {
    test('initLogs should return true on success', async () => {
      global.fetch = jest.fn(() => Promise.resolve({ ok: true })) as jest.Mock;
      const result = await initLogs('/path/to/logs');
      expect(result).toBe(true);
    });

    test('initLogs should return false on non success', async () => {
      global.fetch = jest.fn(() => Promise.resolve({ ok: false })) as jest.Mock;
      const result = await initLogs('/path/to/logs');
      expect(result).toBe(false);
    });

    test('initLogs should return false on error', async () => {
      global.fetch = jest.fn(() => {
        throw new Error('Some error');
      }) as jest.Mock;
      const result = await initLogs('/path/to/logs');

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Eco: Unable to reach the backend. Please check your connection.',
      );

      expect(result).toBe(false);
    });
  });

  describe('fetchSmells', () => {
    test('fetchSmells should return smells array on success', async () => {
      const mockSmells = [{ symbol: 'LongMethod', severity: 'HIGH' }];
      global.fetch = jest.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve(mockSmells) }),
      ) as jest.Mock;

      const result = await fetchSmells('file.py', ['LongMethod']);
      expect(result).toEqual(mockSmells);
    });

    test('fetchSmells should return an empty array on status not ok', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve([]) }),
      ) as jest.Mock;

      const result = await fetchSmells('file.py', ['LongMethod']);

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        `Eco: Failed to fetch smells`,
      );
      expect(result).toEqual([]);
    });

    test('fetchSmells should return an empty array on invalid response format', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(200) }),
      ) as jest.Mock;

      const result = await fetchSmells('file.py', ['LongMethod']);

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        `Eco: Failed to fetch smells`,
      );
      expect(result).toEqual([]);
    });

    test('fetchSmells should return an empty array on error', async () => {
      global.fetch = jest.fn(() => {
        throw new Error('Some error');
      }) as jest.Mock;

      const result = await fetchSmells('file.py', ['LongMethod']);

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        `Eco: Failed to fetch smells`,
      );
      expect(result).toEqual([]);
    });
  });

  describe('refactorSmell', () => {
    test('refactorSmell should return refactor result on success', async () => {
      const mockRefactorOutput = { success: true };

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockRefactorOutput),
        }),
      ) as jest.Mock;

      (vscode.workspace as any).workspaceFolders = [
        { uri: { fsPath: '/mock/workspace' } },
      ];

      const result = await refactorSmell('/mock/workspace/file.py', {
        symbol: 'LongMethod',
      } as Smell);
      expect(result).toEqual(mockRefactorOutput);
    });

    test('refactorSmell should throw and error if no workspace found', async () => {
      const mockRefactorOutput = { success: true };

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockRefactorOutput),
        }),
      ) as jest.Mock;

      (vscode.workspace as any).workspaceFolders = [
        { uri: { fsPath: '/mock/workspace' } },
      ];

      await expect(
        refactorSmell('/mock/another-workspace/file.py', {
          symbol: 'LongMethod',
        } as Smell),
      ).rejects.toThrow(
        'Eco: Unable to find a matching workspace folder for file: /mock/another-workspace/file.py',
      );
    });

    test('refactorSmell should throw and error if not ok response', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          text: jest.fn().mockReturnValue('Some error text'),
        }),
      ) as jest.Mock;

      (vscode.workspace as any).workspaceFolders = [
        { uri: { fsPath: '/mock/workspace' } },
      ];

      await expect(
        refactorSmell('/mock/workspace/file.py', {
          symbol: 'LongMethod',
        } as Smell),
      ).rejects.toThrow('Some error text');
    });

    test('refactorSmell should throw and error if function returns an error', async () => {
      global.fetch = jest.fn(() => {
        throw new Error('Some error');
      }) as jest.Mock;

      (vscode.workspace as any).workspaceFolders = [
        { uri: { fsPath: '/mock/workspace' } },
      ];

      await expect(
        refactorSmell('/mock/workspace/file.py', {
          symbol: 'LongMethod',
        } as Smell),
      ).rejects.toThrow('Some error');
    });
  });
});
