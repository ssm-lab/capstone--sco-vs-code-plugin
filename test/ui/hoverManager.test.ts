// test/hover-manager.test.ts
import vscode from '../mocks/vscode-mock';
import { HoverManager } from '../../src/ui/hoverManager';
import { ContextManager } from '../../src/context/contextManager';
import { Smell, Occurrence } from '../../src/types';

jest.mock('../../src/commands/refactorSmell', () => ({
  refactorSelectedSmell: jest.fn(),
  refactorAllSmellsOfType: jest.fn(),
}));

// Mock the vscode module using our custom mock
// jest.mock('vscode', () => vscode);

describe('HoverManager', () => {
  let contextManagerMock: ContextManager;
  let mockSmells: Smell[];

  const mockOccurrence: Occurrence = {
    line: 5,
    endLine: 7,
    column: 1,
    endColumn: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    contextManagerMock = {
      context: {
        subscriptions: [],
      },
      getContext: () => ({ subscriptions: [] }),
    } as unknown as ContextManager;

    mockSmells = [
      {
        type: 'performance',
        symbol: 'CRS-001',
        message: 'Cached repeated calls',
        messageId: 'cached-repeated-calls',
        confidence: 'HIGH',
        path: '/test/file.py',
        module: 'test_module',
        occurences: [mockOccurrence],
        additionalInfo: {},
      },
    ];
  });

  it('should register hover provider for Python files', () => {
    new HoverManager(contextManagerMock, mockSmells);

    expect(vscode.languages.registerHoverProvider).toHaveBeenCalledWith(
      { scheme: 'file', language: 'python' },
      expect.objectContaining({
        provideHover: expect.any(Function),
      }),
    );
  });

  it('should generate valid hover content', () => {
    const manager = new HoverManager(contextManagerMock, mockSmells);
    const document = {
      fileName: '/test/file.py',
      getText: jest.fn(),
    } as any;

    const position = {
      line: 4, // 0-based line number (will become line 5 in 1-based)
      character: 0,
      isBefore: jest.fn(),
      isBeforeOrEqual: jest.fn(),
      isAfter: jest.fn(),
      isAfterOrEqual: jest.fn(),
      translate: jest.fn(),
      with: jest.fn(),
      compareTo: jest.fn(),
      isEqual: jest.fn(),
    } as any; // Simplified type assertion since we don't need full Position type

    // Mock document text for line range
    document.getText.mockReturnValue('mock code content');
    const content = manager.getHoverContent(document, position);
    console.log(content);

    expect(content?.value).toBeDefined(); // Check value exists
    expect(content?.value).toContain('CRS-001');
    expect(content?.value).toContain('Cached repeated calls');
    expect(content).toBeInstanceOf(vscode.MarkdownString);
    expect(content?.isTrusted).toBe(true);

    // Verify basic structure for each smell
    expect(content?.value).toContain('**CRS-001:** Cached repeated calls');
    expect(content?.value).toMatch(
      '/[Refactor](command:extension.refactorThisSmell?/',
    );
    expect(content?.value).toMatch(
      '/---[Refactor all smells of this type...](command:extension.refactorAllSmellsOfType?/',
    );

    // Verify command parameters are properly encoded
    const expectedSmellParam = encodeURIComponent(JSON.stringify(mockSmells[0]));
    expect(content?.value).toContain(
      `command:extension.refactorThisSmell?${expectedSmellParam}`,
    );
    expect(content?.value).toContain(
      `command:extension.refactorAllSmellsOfType?${expectedSmellParam}`,
    );

    // Verify formatting between elements
    expect(content?.value).toContain('\t\t'); // Verify tab separation
    expect(content?.value).toContain('\n\n'); // Verify line breaks between smells

    // // Verify empty case
    // expect(manager.getHoverContent(document, invalidPosition)).toBeNull();
  });

  it('should register refactor commands', () => {
    new HoverManager(contextManagerMock, mockSmells);

    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      'extension.refactorThisSmell',
      expect.any(Function),
    );

    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      'extension.refactorAllSmellsOfType',
      expect.any(Function),
    );
  });
});
