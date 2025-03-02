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
  createTextEditorDecorationType: jest.fn(() => ({
    dispose: jest.fn(),
  })),
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

// export const MarkdownString = MockMarkdownString;
export const Hover = MockHover;

export interface Vscode {
  window: Window;
  workspace: Workspace;
  languages: typeof languages;
  commands: typeof commands;
  Position: typeof Position;
  Hover: typeof Hover;
}

const vscode: Vscode = {
  window,
  workspace,
  languages,
  commands,
  Position,
  Hover,
};

export default vscode;
