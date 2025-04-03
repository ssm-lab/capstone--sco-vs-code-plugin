import * as vscode from 'vscode';
import { resetConfiguration } from '../../src/commands/resetConfiguration';
import { envConfig } from '../../src/utils/envConfig';

jest.mock('vscode', () => {
  const original = jest.requireActual('vscode');
  return {
    ...original,
    window: {
      showWarningMessage: jest.fn(),
    },
    commands: {
      executeCommand: jest.fn(),
    },
  };
});

describe('resetConfiguration (Jest)', () => {
  const mockContext = {
    workspaceState: {
      update: jest.fn(),
    },
  } as unknown as vscode.ExtensionContext;

  beforeEach(() => {
    jest.resetAllMocks();
    envConfig.WORKSPACE_CONFIGURED_PATH = 'myWorkspaceKey';
  });

  it('should reset workspace configuration when confirmed', async () => {
    (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Reset');

    const result = await resetConfiguration(mockContext);

    expect(mockContext.workspaceState.update).toHaveBeenCalledWith(
      'myWorkspaceKey',
      undefined,
    );

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'setContext',
      'workspaceState.workspaceConfigured',
      false,
    );

    expect(result).toBe(true);
  });

  it('should not reset workspace configuration if user cancels', async () => {
    (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue(undefined);

    const result = await resetConfiguration(mockContext);

    expect(mockContext.workspaceState.update).not.toHaveBeenCalled();
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });
});
