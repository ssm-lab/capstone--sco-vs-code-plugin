// test/exportMetrics.test.ts
import * as vscode from 'vscode';
import { dirname } from 'path';
import { writeFileSync } from 'fs';
import { exportMetricsData } from '../../src/commands/views/exportMetricsData';
import { envConfig } from '../../src/utils/envConfig';
import * as fs from 'fs';

// Mock dependencies
jest.mock('path');
jest.mock('fs');

describe('exportMetricsData', () => {
  let mockContext: vscode.ExtensionContext;
  const mockMetricsData = {
    '/path/to/file1.py': {
      energySaved: 0.5,
      smellType: 'test-smell',
      timestamp: Date.now(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock context
    mockContext = {
      workspaceState: {
        get: jest.fn(),
        update: jest.fn(),
      },
    } as unknown as vscode.ExtensionContext;

    // Mock path.dirname
    (dirname as jest.Mock).mockImplementation((path) => `/parent/${path}`);

    // Mock fs.writeFileSync
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
  });

  it('should show info message when no metrics data exists', async () => {
    (mockContext.workspaceState.get as jest.Mock).mockImplementation((key) => {
      console.log('Mock:', key, envConfig.WORKSPACE_METRICS_DATA);
      if (key === envConfig.WORKSPACE_METRICS_DATA) return {};
      return undefined;
    });

    await exportMetricsData(mockContext);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'No metrics data available to export.',
    );
  });

  it('should show error when no workspace path is configured', async () => {
    (mockContext.workspaceState.get as jest.Mock).mockImplementation((key) => {
      if (key === envConfig.WORKSPACE_CONFIGURED_PATH) return undefined;
      if (key === envConfig.WORKSPACE_METRICS_DATA) return mockMetricsData;
      return undefined; // No workspace path
    });

    await exportMetricsData(mockContext);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'No configured workspace path found.',
    );
  });

  it('should export to workspace directory when path is a directory', async () => {
    const workspacePath = '/workspace/path';

    (mockContext.workspaceState.get as jest.Mock).mockImplementation((key) => {
      if (key === envConfig.WORKSPACE_METRICS_DATA) return mockMetricsData;
      if (key === envConfig.WORKSPACE_CONFIGURED_PATH) return workspacePath;
      return undefined;
    });

    // Mock fs.stat to return directory
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
      type: vscode.FileType.Directory,
    });

    await exportMetricsData(mockContext);

    expect(vscode.Uri.joinPath).toHaveBeenCalledWith(
      expect.anything(),
      'metrics-data.json',
    );
    expect(writeFileSync).toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('metrics-data.json'),
    );
  });

  it('should export to parent directory when path is a file', async () => {
    const workspacePath = '/workspace/path/file.txt';

    (mockContext.workspaceState.get as jest.Mock).mockImplementation((key) => {
      if (key === envConfig.WORKSPACE_METRICS_DATA) return mockMetricsData;
      if (key === envConfig.WORKSPACE_CONFIGURED_PATH) return workspacePath;
      return undefined;
    });

    // Mock fs.stat to return file
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
      type: vscode.FileType.File,
    });

    await exportMetricsData(mockContext);

    expect(dirname).toHaveBeenCalledWith(workspacePath);
    expect(vscode.Uri.joinPath).toHaveBeenCalledWith(
      expect.anything(),
      'metrics-data.json',
    );
    expect(writeFileSync).toHaveBeenCalled();
  });

  it('should show error for invalid workspace path type', async () => {
    const workspacePath = '/workspace/path';

    (mockContext.workspaceState.get as jest.Mock).mockImplementation((key) => {
      if (key === envConfig.WORKSPACE_METRICS_DATA) return mockMetricsData;
      if (key === envConfig.WORKSPACE_CONFIGURED_PATH) return workspacePath;
      return undefined;
    });

    // Mock fs.stat to return unknown type
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
      type: vscode.FileType.Unknown,
    });

    await exportMetricsData(mockContext);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Invalid workspace path type.',
    );
  });

  it('should handle filesystem access errors', async () => {
    const workspacePath = '/workspace/path';

    (mockContext.workspaceState.get as jest.Mock).mockImplementation((key) => {
      if (key === envConfig.WORKSPACE_METRICS_DATA) return mockMetricsData;
      if (key === envConfig.WORKSPACE_CONFIGURED_PATH) return workspacePath;
      return undefined;
    });

    // Mock fs.stat to throw error
    (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(
      new Error('Access denied'),
    );

    await exportMetricsData(mockContext);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Failed to access workspace path'),
    );
  });

  it('should handle file write errors', async () => {
    const workspacePath = '/workspace/path';

    (mockContext.workspaceState.get as jest.Mock).mockImplementation((key) => {
      if (key === envConfig.WORKSPACE_METRICS_DATA) return mockMetricsData;
      if (key === envConfig.WORKSPACE_CONFIGURED_PATH) return workspacePath;
      return undefined;
    });

    // Mock fs.stat to return directory
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
      type: vscode.FileType.Directory,
    });

    // Mock writeFileSync to throw error
    (writeFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('Write failed');
    });

    await exportMetricsData(mockContext);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Failed to export metrics data'),
    );
  });
});
