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
  },
  selection: {
    start: { line: 0, character: 0 },
    end: { line: 0, character: 0 },
  },
};

interface Window {
  showInformationMessage: jest.Mock;
  showErrorMessage: jest.Mock;
  showWarningMessage: jest.Mock;
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

export class MockMarkdownString {
  value: string;
  isTrusted: boolean = false;

  constructor() {
    this.value = '';
    this.isTrusted = false;
  }

  appendMarkdown(value: string): MockMarkdownString {
    this.value += value;
    return this;
  }
}

export class MockHover {
  constructor(public contents: MockMarkdownString | MockMarkdownString[]) {}
}

export const MarkdownString = MockMarkdownString;
export const Hover = MockHover;

export interface Vscode {
  window: Window;
  workspace: Workspace;
  languages: typeof languages;
  commands: typeof commands;
  Position: typeof Position;
  MarkdownString: typeof MarkdownString;
  Hover: typeof Hover;
}

const vscode: Vscode = {
  window,
  workspace,
  languages,
  commands,
  Position,
  MarkdownString,
  Hover,
};

export default vscode;
