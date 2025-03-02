// test/hover-manager.test.ts
// import vscode from '../mocks/vscode-mock';
import { HoverManager } from '../../src/ui/hoverManager';
import { ContextManager } from '../../src/context/contextManager';
import { Smell, Occurrence } from '../../src/types';
import vscode from 'vscode';

jest.mock('vscode');

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

  it('should subscribe hover provider correctly', () => {
    const spy = jest.spyOn(contextManagerMock.context.subscriptions, 'push');
    new HoverManager(contextManagerMock, mockSmells);
    expect(spy).toHaveBeenCalledWith(expect.anything());
  });

  it('should return null for hover content if there are no smells', () => {
    const manager = new HoverManager(contextManagerMock, []);
    const document = { fileName: '/test/file.py', getText: jest.fn() } as any;
    const position = { line: 4 } as any;
    expect(manager.getHoverContent(document, position)).toBeNull();
  });

  it('should update smells when getInstance is called again', () => {
    const initialSmells = [
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

    const newSmells = [
      {
        type: 'memory',
        symbol: 'MEM-002',
        message: 'Memory leak detected',
        messageId: 'memory-leak',
        confidence: 'MEDIUM',
        path: '/test/file2.py',
        module: 'test_module_2',
        occurences: [mockOccurrence],
        additionalInfo: {},
      },
    ];

    const manager1 = HoverManager.getInstance(contextManagerMock, initialSmells);
    expect(manager1['smells']).toEqual(initialSmells);

    const manager2 = HoverManager.getInstance(contextManagerMock, newSmells);
    expect(manager2['smells']).toEqual(newSmells);
    expect(manager1).toBe(manager2); // Ensuring it's the same instance
  });

  it('should update smells correctly', () => {
    const manager = new HoverManager(contextManagerMock, mockSmells);
    const newSmells: Smell[] = [
      {
        type: 'security',
        symbol: 'SEC-003',
        message: 'Unsafe API usage',
        messageId: 'unsafe-api',
        confidence: 'HIGH',
        path: '/test/file3.py',
        module: 'security_module',
        occurences: [mockOccurrence],
        additionalInfo: {},
      },
    ];

    manager.updateSmells(newSmells);
    expect(manager['smells']).toEqual(newSmells);
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

    expect(content?.value).toBeDefined(); // Check value exists
    expect(content?.value).toContain('CRS-001');
    expect(content?.value).toContain('Cached repeated calls');
    expect(content?.isTrusted).toBe(true);

    // Verify basic structure for each smell
    expect(content?.value).toContain('**CRS-001:** Cached repeated calls');
    expect(content?.value).toContain(
      '[Refactor](command:extension.refactorThisSmell?',
    );
    expect(content?.value).toContain(
      '[Refactor all smells of this type...](command:extension.refactorAllSmellsOfType?',
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
