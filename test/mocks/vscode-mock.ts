// test/mocks/vscode-mock.ts
interface Config {
  configGet: any;
  filePath: any;
  docText: any;
  workspacePath: any;
}

// Configuration object to dynamically change values during tests
export const config: Config = {
  configGet: { smell1: true, smell2: true },
  filePath: 'fake.py',
  docText: 'Mock document text',
  workspacePath: '/workspace/path',
};

export const TextDocument = {
  getText: jest.fn(() => config.docText),
  fileName: config.filePath,
  languageId: 'python',
  lineAt: jest.fn((line: number) => {
    return {
      text: 'Mock line text',
    };
  }),
  lineCount: 10,
  uri: {
    scheme: 'file',
    fsPath: config.filePath,
  },
};

// Mock for `vscode.TextEditor`
export const TextEditor = {
  document: TextDocument,
  selection: {
    start: { line: 0, character: 0 },
    end: { line: 0, character: 0 },
    isSingleLine: true,
  },
  setDecorations: jest.fn(),
  revealRange: jest.fn(),
};

export interface TextEditorDecorationType {
  dispose: jest.Mock;
}

const textEditorDecorationType: TextEditorDecorationType = {
  dispose: jest.fn(),
};

interface Window {
  showInformationMessage: jest.Mock;
  showErrorMessage: jest.Mock;
  showWarningMessage: jest.Mock;
  createTextEditorDecorationType: jest.Mock;
  createOutputChannel: jest.Mock;
  activeTextEditor: any;
  visibleTextEditors: any[];
  withProgress: jest.Mock;
  showQuickPick: jest.Mock;
}

export const window: Window = {
  showInformationMessage: jest.fn(async (message: string, options?: any) => {
    return options?.modal ? 'Confirm' : message;
  }),
  showErrorMessage: jest.fn(async (message: string) => {
    return message;
  }),
  showWarningMessage: jest.fn(async (message: string, options?: any) => {
    return options?.modal ? 'Confirm' : message;
  }),
  activeTextEditor: TextEditor,
  visibleTextEditors: [],
  createTextEditorDecorationType: jest.fn((_options: any) => {
    return textEditorDecorationType;
  }),
  createOutputChannel: jest.fn(() => ({
    appendLine: jest.fn(),
    show: jest.fn(),
    clear: jest.fn(),
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
  })),
  withProgress: jest.fn((options, task) => {
    return task({
      report: jest.fn(),
    });
  }),
  showQuickPick: jest.fn(),
};

export enum FileType {
  Directory = 1,
  File = 2,
}

export const fileStat = {
  type: FileType.Directory,
};

interface Workspace {
  getConfiguration: jest.Mock;
  findFiles: jest.Mock;
  fs: {
    readFile: jest.Mock;
    writeFile: jest.Mock;
    stat: typeof fileStat;
  };
}

export const workspace: Workspace = {
  getConfiguration: jest.fn((section?: string) => ({
    get: jest.fn(() => config.configGet),
    update: jest.fn(),
  })),
  findFiles: jest.fn(),
  fs: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    stat: fileStat,
  },
};

interface MockCommand {
  title: string;
  command: string;
  arguments?: any[];
  tooltip?: string;
}

export const Command = jest
  .fn()
  .mockImplementation((title: string, command: string, ...args: any[]) => {
    return {
      title,
      command,
      arguments: args,
      tooltip: title,
    };
  }) as jest.Mock & {
  prototype: MockCommand;
};

export const OverviewRulerLane = {
  Right: 'Right',
};

export const Range = class MockRange {
  constructor(
    public startLine: number,
    public startCharacter: number,
    public endLine: number,
    public endCharacter: number,
  ) {}
};

export const languages = {
  registerHoverProvider: jest.fn(() => ({
    dispose: jest.fn(),
  })),
  registerCodeActionsProvider: jest.fn(),
};

export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15,
}

// ProgressOptions interface
interface ProgressOptions {
  location: ProgressLocation | { viewId: string };
  title?: string;
  cancellable?: boolean;
}

// Progress mock
interface Progress<T> {
  report(value: T): void;
}

// Window.withProgress mock implementation
window.withProgress = jest.fn(
  (
    options: ProgressOptions,
    task: (
      progress: Progress<{ message?: string; increment?: number }>,
    ) => Promise<any>,
  ) => {
    const progress = {
      report: jest.fn(),
    };
    return task(progress);
  },
);

export const commands = {
  registerCommand: jest.fn(),
  executeCommand: jest.fn((command: string) => {
    if (command === 'setContext') {
      return Promise.resolve();
    }
    return Promise.resolve();
  }),
};

export const Uri = {
  file: jest.fn((path: string) => ({
    scheme: 'file',
    path,
    fsPath: path,
    toString: () => path,
  })),
  parse: jest.fn(),
};

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

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export class MockTreeItem {
  constructor(
    public label: string,
    public collapsibleState?: TreeItemCollapsibleState,
    public command?: MockCommand,
  ) {}

  iconPath?:
    | string
    | typeof Uri
    | { light: string | typeof Uri; dark: string | typeof Uri };
  description?: string;
  tooltip?: string;
  contextValue?: string;
}

export const TreeItem = MockTreeItem;

export const Hover = MockHover;

export const ExtensionContext = {
  subscriptions: [],
  workspaceState: {
    get: jest.fn((key: string) => {
      if (key === 'workspaceConfiguredPath') {
        return config.workspacePath;
      }
      return undefined;
    }),
    update: jest.fn(),
  },
  globalState: {
    get: jest.fn(),
    update: jest.fn(),
  },
};

export interface Vscode {
  window: Window;
  workspace: Workspace;
  TextDocument: typeof TextDocument;
  TextEditor: typeof TextEditor;
  TextEditorDecorationType: TextEditorDecorationType;
  languages: typeof languages;
  commands: typeof commands;
  OverviewRulerLane: typeof OverviewRulerLane;
  ProgressLocation: typeof ProgressLocation;
  FileType: typeof FileType;
  Range: typeof Range;
  Position: typeof Position;
  Hover: typeof Hover;
  Command: typeof Command;
  Uri: typeof Uri;
  TreeItem: typeof TreeItem;
  TreeItemCollapsibleState: typeof TreeItemCollapsibleState;
  ExtensionContext: typeof ExtensionContext;
}

const vscode: Vscode = {
  window,
  workspace,
  TextDocument,
  TextEditor,
  TextEditorDecorationType: textEditorDecorationType,
  languages,
  commands,
  OverviewRulerLane,
  ProgressLocation,
  FileType,
  Range,
  Position,
  Hover,
  Command,
  Uri,
  TreeItem,
  TreeItemCollapsibleState,
  ExtensionContext,
};

export default vscode;
