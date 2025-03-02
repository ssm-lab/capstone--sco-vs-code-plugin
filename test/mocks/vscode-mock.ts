// test/mocks/vscode-mock.ts
interface Config {
  configGet: any;
  filePath: any;
  docText: any;
}

// Configuration object to dynamically change values during tests
export const config: Config = {
  configGet: { smell1: true, smell2: true },
  filePath: 'fake.py',
  docText: 'Mock document text',
};

// Mock for `vscode.TextEditor`
export const TextEditor = {
  document: {
    getText: jest.fn(() => config.docText),
    fileName: config.filePath,
    languageId: 'python',
    lineAt: jest.fn((line: number) => ({
      text: `mock line content ${line}`,
    })),
  },
  selection: {
    start: { line: 0, character: 0 },
    end: { line: 0, character: 0 },
    isSingleLine: true,
  },
  setDecorations: jest.fn(),
};

// Add Range mock class
export class MockRange {
  public start: { line: number; character: number };
  public end: { line: number; character: number };

  constructor(
    startLine: number,
    startCharacter: number,
    endLine: number,
    endCharacter: number,
  ) {
    this.start = { line: startLine, character: startCharacter };
    this.end = { line: endLine, character: endCharacter };
  }
}

interface Window {
  showInformationMessage: jest.Mock;
  showErrorMessage: jest.Mock;
  showWarningMessage: jest.Mock;
  createTextEditorDecorationType: jest.Mock;
  activeTextEditor: any;
  visibleTextEditors: any[];
}

export const window = {
  showInformationMessage: jest.fn(async (message: string) => {
    console.log('MOCK showInformationMessage:', message);
    return message;
  }),
  showErrorMessage: jest.fn(async (message: string) => {
    console.log('MOCK showErrorMessage:', message);
    return message;
  }),
  showWarningMessage: jest.fn(async (message: string) => {
    console.log('MOCK showWarningMessage:', message);
    return message;
  }),
  // Enhanced mock for `createTextEditorDecorationType`
  createTextEditorDecorationType: jest.fn((decorationOptions) => {
    console.log(
      'MOCK createTextEditorDecorationType called with:',
      decorationOptions,
    );
    return {
      dispose: jest.fn(),
      decorationOptions, // Store the decoration options for testing
    };
  }),
  activeTextEditor: TextEditor,
  visibleTextEditors: [],
};

interface Workspace {
  getConfiguration: jest.Mock;
}

export const workspace: Workspace = {
  getConfiguration: jest.fn((section?: string) => ({
    get: jest.fn((key: string, _defaultReturn: any) => {
      console.log(`MOCK getConfiguration: ${section}.${key}`);
      return config.configGet;
    }),
  })),
};

// New mocks for hover functionality
export const languages = {
  registerHoverProvider: jest.fn(() => ({
    dispose: jest.fn(),
  })),
};

export const commands = {
  registerCommand: jest.fn(),
};

// Mock VS Code classes
export const Position = class MockPosition {
  constructor(
    public line: number,
    public character: number,
  ) {}
};

interface MockMarkdownString {
  appendMarkdown: jest.Mock;
  value: string;
  isTrusted: boolean;
}

// Create a constructor function mock
export const MarkdownString = jest.fn().mockImplementation(() => {
  return {
    appendMarkdown: jest.fn(function (this: any, value: string) {
      this.value += value;
      return this;
    }),
    value: '',
    isTrusted: false,
  };
}) as jest.Mock & {
  prototype: MockMarkdownString;
};

export class MockHover {
  constructor(public contents: MockMarkdownString) {}
}

export const Hover = MockHover;
export const Range = MockRange; // Use MockRange here

export interface Vscode {
  window: Window;
  workspace: Workspace;
  languages: typeof languages;
  commands: typeof commands;
  Position: typeof Position;
  Range: typeof Range; // Add Range to interface
  Hover: typeof Hover;
}

const vscode: Vscode = {
  window,
  workspace,
  languages,
  commands,
  Position,
  Range, // Add Range mock
  Hover,
};

export default vscode;
