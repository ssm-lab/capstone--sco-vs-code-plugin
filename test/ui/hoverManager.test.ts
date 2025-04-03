import * as vscode from 'vscode';
import { HoverManager } from '../../src/ui/hoverManager';
import { SmellsCacheManager } from '../../src/context/SmellsCacheManager';

// Create a simple mock Uri implementation
const mockUri = (path: string): vscode.Uri => ({
  scheme: 'file',
  authority: '',
  path,
  fsPath: path,
  query: '',
  fragment: '',
  with: jest.fn(),
  toString: jest.fn(() => path),
  toJSON: jest.fn(() => ({ path })),
});

// Mock the vscode module with all required components
jest.mock('vscode', () => {
  const actualVscode = jest.requireActual('vscode');

  // Mock MarkdownString implementation
  const mockMarkdownString = {
    isTrusted: true,
    supportHtml: true,
    supportThemeIcons: true,
    appendMarkdown: jest.fn(),
  };

  return {
    ...actualVscode,
    languages: {
      registerHoverProvider: jest.fn(),
    },
    MarkdownString: jest.fn(() => mockMarkdownString),
    Hover: jest.fn(),
    Position: jest.fn(),
    Uri: {
      file: jest.fn((path) => mockUri(path)),
      parse: jest.fn((path) => mockUri(path)),
    },
  };
});

describe('HoverManager', () => {
  let hoverManager: HoverManager;
  let mockSmellsCacheManager: jest.Mocked<SmellsCacheManager>;
  let mockContext: vscode.ExtensionContext;
  let mockDocument: vscode.TextDocument;
  let mockPosition: vscode.Position;

  const createMockSmell = (messageId: string, line: number) => ({
    type: 'performance',
    symbol: 'test-smell',
    message: 'Test smell message',
    messageId,
    confidence: 'HIGH',
    path: '/test/file.py',
    module: 'test',
    occurences: [
      {
        line,
        column: 1,
        endLine: line,
        endColumn: 10,
      },
    ],
    additionalInfo: {},
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockSmellsCacheManager = {
      getCachedSmells: jest.fn(),
    } as unknown as jest.Mocked<SmellsCacheManager>;

    mockContext = {
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;

    mockDocument = {
      uri: vscode.Uri.file('/test/file.py'),
      fileName: '/test/file.py',
      lineAt: jest.fn(),
    } as unknown as vscode.TextDocument;

    mockPosition = {
      line: 5,
      character: 0,
    } as unknown as vscode.Position;

    hoverManager = new HoverManager(mockSmellsCacheManager);
  });

  describe('register', () => {
    it('should register hover provider for Python files', () => {
      hoverManager.register(mockContext);

      expect(vscode.languages.registerHoverProvider).toHaveBeenCalledWith(
        { language: 'python', scheme: 'file' },
        hoverManager,
      );
      expect(mockContext.subscriptions).toHaveLength(1);
    });
  });

  describe('provideHover', () => {
    it('should return undefined for non-Python files', () => {
      const jsDocument = {
        uri: vscode.Uri.file('/test/file.js'),
        fileName: '/test/file.js',
      } as vscode.TextDocument;

      const result = hoverManager.provideHover(
        jsDocument,
        mockPosition,
        {} as vscode.CancellationToken,
      );
      expect(result).toBeUndefined();
    });

    it('should return undefined when no smells are cached', () => {
      mockSmellsCacheManager.getCachedSmells.mockReturnValue(undefined);
      const result = hoverManager.provideHover(
        mockDocument,
        mockPosition,
        {} as vscode.CancellationToken,
      );
      expect(result).toBeUndefined();
    });

    it('should return undefined when no smells at line', () => {
      mockSmellsCacheManager.getCachedSmells.mockReturnValue([
        createMockSmell('test-smell', 10), // Different line
      ]);
      const result = hoverManager.provideHover(
        mockDocument,
        mockPosition,
        {} as vscode.CancellationToken,
      );
      expect(result).toBeUndefined();
    });

    it('should create hover for single smell at line', () => {
      const mockSmell = createMockSmell('test-smell', 6); // line + 1
      mockSmellsCacheManager.getCachedSmells.mockReturnValue([mockSmell]);

      const result = hoverManager.provideHover(
        mockDocument,
        mockPosition,
        {} as vscode.CancellationToken,
      );

      expect(vscode.MarkdownString).toHaveBeenCalled();
      expect(vscode.Hover).toHaveBeenCalled();

      // Get the mock MarkdownString instance
      const markdownInstance = (vscode.MarkdownString as jest.Mock).mock.results[0]
        .value;
      expect(markdownInstance.appendMarkdown).toHaveBeenCalledWith(
        expect.stringContaining('Test smell message'),
      );
      expect(markdownInstance.appendMarkdown).toHaveBeenCalledWith(
        expect.stringContaining('command:ecooptimizer.refactorSmell'),
      );
    });

    it('should escape special characters in messages', () => {
      const mockSmell = {
        ...createMockSmell('test-smell', 6),
        message: 'Message with *stars* and _underscores_',
        messageId: 'id_with*stars*',
      };
      mockSmellsCacheManager.getCachedSmells.mockReturnValue([mockSmell]);

      hoverManager.provideHover(
        mockDocument,
        mockPosition,
        {} as vscode.CancellationToken,
      );

      const markdownInstance = (vscode.MarkdownString as jest.Mock).mock.results[0]
        .value;
      expect(markdownInstance.appendMarkdown).toHaveBeenCalledWith(
        expect.stringContaining('Message with \\*stars\\* and \\_underscores\\_'),
      );
    });
  });
});
