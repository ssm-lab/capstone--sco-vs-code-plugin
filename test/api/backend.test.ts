/* eslint-disable unused-imports/no-unused-imports */
import path from 'path';

import { envConfig } from '../../src/utils/envConfig';
import {
  checkServerStatus,
  initLogs,
  fetchSmells,
  backendRefactorSmell,
  backendRefactorSmellType,
} from '../../src/api/backend';
import { serverStatus, ServerStatusType } from '../../src/emitters/serverStatus';
import { ecoOutput } from '../../src/extension';

// Mock dependencies
jest.mock('../../src/emitters/serverStatus');
jest.mock('../../src/extension');
jest.mock('../../src/utils/envConfig');
jest.mock('path', () => ({
  basename: jest.fn((path) => path.split('/').pop()),
}));

// Mock global fetch
global.fetch = jest.fn() as jest.Mock;

describe('Backend Service', () => {
  const mockServerUrl = 'localhost:8000';
  const mockLogDir = '/path/to/logs';
  const mockFilePath = '/project/src/file.py';
  const mockWorkspacePath = '/project';
  const mockSmell = {
    symbol: 'test-smell',
    path: mockFilePath,
    occurences: [{ line: 1 }],
    message: 'Test smell message',
    messageId: 'test-001',
  } as unknown as Smell;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkServerStatus', () => {
    it('should set status UP when server is healthy', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      await checkServerStatus();

      expect(fetch).toHaveBeenCalledWith(`http://${mockServerUrl}/health`);
      expect(serverStatus.setStatus).toHaveBeenCalledWith(ServerStatusType.UP);
      expect(ecoOutput.trace).toHaveBeenCalledWith(
        '[backend.ts] Backend server is healthy',
      );
    });

    it('should set status DOWN when server responds with error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });

      await checkServerStatus();

      expect(serverStatus.setStatus).toHaveBeenCalledWith(ServerStatusType.DOWN);
      expect(ecoOutput.warn).toHaveBeenCalledWith(
        '[backend.ts] Backend server unhealthy status: 500',
      );
    });

    it('should set status DOWN and log error when request fails', async () => {
      const mockError = new Error('Network error');
      (fetch as jest.Mock).mockRejectedValueOnce(mockError);

      await checkServerStatus();

      expect(serverStatus.setStatus).toHaveBeenCalledWith(ServerStatusType.DOWN);
      expect(ecoOutput.error).toHaveBeenCalledWith(
        '[backend.ts] Server connection failed: Network error',
      );
    });
  });

  describe('initLogs', () => {
    it('should successfully initialize logs', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      const result = await initLogs(mockLogDir);

      expect(fetch).toHaveBeenCalledWith(`http://${mockServerUrl}/logs/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_dir: mockLogDir }),
      });
      expect(result).toBe(true);
    });

    it('should return false when server responds with not ok', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

      const result = await initLogs(mockLogDir);

      expect(result).toBe(false);
      expect(ecoOutput.error).toHaveBeenCalledWith(
        expect.stringContaining('Unable to initialize logging'),
      );
    });

    it('should handle network errors', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network failed'));

      const result = await initLogs(mockLogDir);

      expect(result).toBe(false);
      expect(ecoOutput.error).toHaveBeenCalledWith(
        'Eco: Unable to reach the backend. Please check your connection.',
      );
    });
  });

  describe('fetchSmells', () => {
    const mockEnabledSmells = { 'test-smell': { threshold: 0.5 } };
    const mockSmellsResponse = [mockSmell];

    it('should successfully fetch smells', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: jest.fn().mockResolvedValueOnce(mockSmellsResponse),
      };
      (fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await fetchSmells(mockFilePath, mockEnabledSmells);

      expect(fetch).toHaveBeenCalledWith(`http://${mockServerUrl}/smells`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: mockFilePath,
          enabled_smells: mockEnabledSmells,
        }),
      });
      expect(result).toEqual({ smells: mockSmellsResponse, status: 200 });
      expect(ecoOutput.info).toHaveBeenCalledWith(
        '[backend.ts] Starting smell detection for: file.py',
      );
      expect(ecoOutput.info).toHaveBeenCalledWith(
        '[backend.ts] Detection complete for file.py',
      );
    });

    it('should throw error when server responds with error', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValueOnce({ detail: 'Server error' }),
      };
      (fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      await expect(fetchSmells(mockFilePath, mockEnabledSmells)).rejects.toThrow(
        'Backend request failed (500)',
      );

      expect(ecoOutput.error).toHaveBeenCalledWith(
        '[backend.ts] Backend error details:',
        { detail: 'Server error' },
      );
    });

    it('should throw error when network fails', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network failed'));

      await expect(fetchSmells(mockFilePath, mockEnabledSmells)).rejects.toThrow(
        'Detection failed: Network failed',
      );

      expect(ecoOutput.error).toHaveBeenCalledWith(
        '[backend.ts] Smell detection failed for file.py: Network failed',
      );
    });
  });

  describe('backendRefactorSmell', () => {
    it('should successfully refactor smell', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ success: true }),
      };
      (fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await backendRefactorSmell(mockSmell, mockWorkspacePath);

      expect(fetch).toHaveBeenCalledWith(`http://${mockServerUrl}/refactor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceDir: mockWorkspacePath,
          smell: mockSmell,
        }),
      });
      expect(result).toEqual({ success: true });
      expect(ecoOutput.info).toHaveBeenCalledWith(
        '[backend.ts] Starting refactoring for smell: test-smell',
      );
    });

    it('should throw error when no workspace path', async () => {
      await expect(backendRefactorSmell(mockSmell, '')).rejects.toThrow(
        'No workspace path provided',
      );

      expect(ecoOutput.error).toHaveBeenCalledWith(
        '[backend.ts] Refactoring aborted: No workspace path',
      );
    });

    it('should throw error when server responds with error', async () => {
      const mockResponse = {
        ok: false,
        json: jest.fn().mockResolvedValueOnce({ detail: 'Refactor failed' }),
      };
      (fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      await expect(
        backendRefactorSmell(mockSmell, mockWorkspacePath),
      ).rejects.toThrow('Refactoring failed');

      expect(ecoOutput.error).toHaveBeenCalledWith(
        '[backend.ts] Refactoring failed: Refactor failed',
      );
    });
  });

  describe('backendRefactorSmellType', () => {
    it('should successfully refactor smell type', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ success: true }),
      };
      (fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await backendRefactorSmellType(mockSmell, mockWorkspacePath);

      expect(fetch).toHaveBeenCalledWith(
        `http://${mockServerUrl}/refactor-by-type`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceDir: mockWorkspacePath,
            smellType: 'test-smell',
            firstSmell: mockSmell,
          }),
        },
      );
      expect(result).toEqual({ success: true });
      expect(ecoOutput.info).toHaveBeenCalledWith(
        '[backend.ts] Starting refactoring for smells of type "test-smell" in "/project/src/file.py"',
      );
    });

    it('should throw error when no workspace path', async () => {
      await expect(backendRefactorSmellType(mockSmell, '')).rejects.toThrow(
        'No workspace path provided',
      );
    });

    it('should throw error when server responds with error', async () => {
      const mockResponse = {
        ok: false,
        json: jest.fn().mockResolvedValueOnce({ detail: 'Type refactor failed' }),
      };
      (fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      await expect(
        backendRefactorSmellType(mockSmell, mockWorkspacePath),
      ).rejects.toThrow('Type refactor failed');
    });
  });
});
