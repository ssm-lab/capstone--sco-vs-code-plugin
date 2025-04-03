// test/commands/registerFilterSmellCommands.test.ts
import * as vscode from 'vscode';
import { registerFilterSmellCommands } from '../../src/commands/views/filterSmells';
import { FilterViewProvider } from '../../src/providers/FilterViewProvider';

// Mock the FilterViewProvider
jest.mock('../../src/providers/FilterViewProvider');

describe('registerFilterSmellCommands', () => {
  let mockContext: vscode.ExtensionContext;
  let mockFilterProvider: jest.Mocked<FilterViewProvider>;
  let mockCommands: jest.Mocked<typeof vscode.commands>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock context
    mockContext = {
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;

    // Setup mock filter provider
    mockFilterProvider = {
      toggleSmell: jest.fn(),
      updateOption: jest.fn(),
      refresh: jest.fn(),
      setAllSmellsEnabled: jest.fn(),
      resetToDefaults: jest.fn(),
    } as unknown as jest.Mocked<FilterViewProvider>;

    // Mock commands
    mockCommands = vscode.commands as jest.Mocked<typeof vscode.commands>;
  });

  it('should register toggleSmellFilter command', () => {
    registerFilterSmellCommands(mockContext, mockFilterProvider);

    // Verify command registration
    expect(mockCommands.registerCommand).toHaveBeenCalledWith(
      'ecooptimizer.toggleSmellFilter',
      expect.any(Function),
    );

    // Test the command handler
    const [, handler] = (mockCommands.registerCommand as jest.Mock).mock.calls[0];
    handler('test-smell');
    expect(mockFilterProvider.toggleSmell).toHaveBeenCalledWith('test-smell');
  });

  it('should register editSmellFilterOption command with valid input', async () => {
    registerFilterSmellCommands(mockContext, mockFilterProvider);

    // Mock showInputBox to return valid number
    (vscode.window.showInputBox as jest.Mock).mockResolvedValue('42');

    // Get the command handler
    const editCommandCall = (
      mockCommands.registerCommand as jest.Mock
    ).mock.calls.find((call) => call[0] === 'ecooptimizer.editSmellFilterOption');
    const [, handler] = editCommandCall;

    // Test with valid item
    await handler({ smellKey: 'test-smell', optionKey: 'threshold', value: 10 });

    expect(vscode.window.showInputBox).toHaveBeenCalledWith({
      prompt: 'Enter a new value for threshold',
      value: '10',
      validateInput: expect.any(Function),
    });
    expect(mockFilterProvider.updateOption).toHaveBeenCalledWith(
      'test-smell',
      'threshold',
      42,
    );
    expect(mockFilterProvider.refresh).toHaveBeenCalled();
  });

  it('should handle editSmellFilterOption with invalid input', async () => {
    registerFilterSmellCommands(mockContext, mockFilterProvider);

    // Mock showInputBox to return invalid input
    (vscode.window.showInputBox as jest.Mock).mockResolvedValue('not-a-number');

    const editCommandCall = (
      mockCommands.registerCommand as jest.Mock
    ).mock.calls.find((call) => call[0] === 'ecooptimizer.editSmellFilterOption');
    const [, handler] = editCommandCall;

    await handler({ smellKey: 'test-smell', optionKey: 'threshold', value: 10 });

    expect(mockFilterProvider.updateOption).not.toHaveBeenCalled();
  });

  it('should show error for editSmellFilterOption with missing keys', async () => {
    registerFilterSmellCommands(mockContext, mockFilterProvider);

    const editCommandCall = (
      mockCommands.registerCommand as jest.Mock
    ).mock.calls.find((call) => call[0] === 'ecooptimizer.editSmellFilterOption');
    const [, handler] = editCommandCall;

    await handler({});
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Error: Missing smell or option key.',
    );
  });

  it('should register selectAllFilterSmells command', () => {
    registerFilterSmellCommands(mockContext, mockFilterProvider);

    const selectAllCall = (
      mockCommands.registerCommand as jest.Mock
    ).mock.calls.find((call) => call[0] === 'ecooptimizer.selectAllFilterSmells');
    const [, handler] = selectAllCall;

    handler();
    expect(mockFilterProvider.setAllSmellsEnabled).toHaveBeenCalledWith(true);
  });

  it('should register deselectAllFilterSmells command', () => {
    registerFilterSmellCommands(mockContext, mockFilterProvider);

    const deselectAllCall = (
      mockCommands.registerCommand as jest.Mock
    ).mock.calls.find((call) => call[0] === 'ecooptimizer.deselectAllFilterSmells');
    const [, handler] = deselectAllCall;

    handler();
    expect(mockFilterProvider.setAllSmellsEnabled).toHaveBeenCalledWith(false);
  });

  it('should register setFilterDefaults command', () => {
    registerFilterSmellCommands(mockContext, mockFilterProvider);

    const setDefaultsCall = (
      mockCommands.registerCommand as jest.Mock
    ).mock.calls.find((call) => call[0] === 'ecooptimizer.setFilterDefaults');
    const [, handler] = setDefaultsCall;

    handler();
    expect(mockFilterProvider.resetToDefaults).toHaveBeenCalled();
  });

  it('should add all commands to context subscriptions', () => {
    registerFilterSmellCommands(mockContext, mockFilterProvider);

    // Verify all commands were added to subscriptions
    expect(mockContext.subscriptions).toHaveLength(5);
  });
});
