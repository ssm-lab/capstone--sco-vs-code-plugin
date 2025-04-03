import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { configureWorkspace } from '../../src/commands/configureWorkspace';
import { envConfig } from '../../src/utils/envConfig';

jest.mock('fs');
jest.mock('vscode', () => {
  const original = jest.requireActual('vscode');
  return {
    ...original,
    workspace: { workspaceFolders: [] },
    window: {
      showQuickPick: jest.fn(),
      showInformationMessage: jest.fn(),
      showErrorMessage: jest.fn(),
    },
    commands: {
      executeCommand: jest.fn(),
    },
  };
});

describe('configureWorkspace (Jest)', () => {
  const mockContext = {
    workspaceState: {
      update: jest.fn(),
    },
  } as unknown as vscode.ExtensionContext;

  beforeEach(() => {
    jest.resetAllMocks();

    // Mock a workspace folder
    (vscode.workspace.workspaceFolders as any) = [
      {
        uri: { fsPath: '/project' },
      },
    ];

    // Mock fs behavior
    (fs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
      if (dirPath === '/project') {
        return ['main.py', 'subdir'];
      } else if (dirPath === '/project/subdir') {
        return ['__init__.py'];
      }
      return [];
    });

    (fs.statSync as jest.Mock).mockImplementation((filePath: string) => ({
      isDirectory: () => !filePath.endsWith('.py'),
    }));

    // Mock quick pick
    (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({
      label: 'project',
      description: '/project',
      detail: 'Python content: main.py',
      folderPath: '/project',
    });

    envConfig.WORKSPACE_CONFIGURED_PATH = 'myWorkspaceKey';
  });

  it('should detect Python folders and configure the workspace', async () => {
    await configureWorkspace(mockContext);

    expect(mockContext.workspaceState.update).toHaveBeenCalledWith(
      'myWorkspaceKey',
      '/project',
    );

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'setContext',
      'workspaceState.workspaceConfigured',
      true,
    );

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Configured workspace: project',
    );
  });
});
