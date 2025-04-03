import * as vscode from 'vscode';
import {
  initializeRefactorActionButtons,
  showRefactorActionButtons,
  hideRefactorActionButtons,
} from '../../src/utils/refactorActionButtons';

jest.mock('vscode', () => {
  const original = jest.requireActual('vscode');
  return {
    ...original,
    StatusBarAlignment: {
      Right: 2, // You can use the actual enum value or a string
    },
    window: {
      createStatusBarItem: jest.fn(),
    },
    commands: {
      executeCommand: jest.fn(),
    },
    ThemeColor: jest.fn().mockImplementation((color) => color),
  };
});

jest.mock('../../src/extension', () => ({
  ecoOutput: {
    trace: jest.fn(),
    replace: jest.fn(),
  },
}));

describe('Refactor Action Buttons', () => {
  const acceptMock = {
    show: jest.fn(),
    hide: jest.fn(),
  };
  const rejectMock = {
    show: jest.fn(),
    hide: jest.fn(),
  };

  const pushSpy = jest.fn();
  const mockContext = {
    subscriptions: { push: pushSpy },
  } as unknown as vscode.ExtensionContext;

  beforeEach(() => {
    jest.resetAllMocks();
    pushSpy.mockClear();

    (vscode.window.createStatusBarItem as jest.Mock)
      .mockImplementationOnce(() => acceptMock)
      .mockImplementationOnce(() => rejectMock);
  });

  it('should show the buttons and set context when shown', () => {
    initializeRefactorActionButtons(mockContext);
    showRefactorActionButtons();

    expect(acceptMock.show).toHaveBeenCalled();
    expect(rejectMock.show).toHaveBeenCalled();
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'setContext',
      'refactoringInProgress',
      true,
    );
  });

  it('should hide the buttons and clear context when hidden', () => {
    initializeRefactorActionButtons(mockContext);
    hideRefactorActionButtons();

    expect(acceptMock.hide).toHaveBeenCalled();
    expect(rejectMock.hide).toHaveBeenCalled();
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'setContext',
      'refactoringInProgress',
      false,
    );
  });
});
