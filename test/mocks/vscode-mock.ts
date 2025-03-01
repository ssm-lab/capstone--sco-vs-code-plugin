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
    getText: jest.fn(() => {
      console.log('MOCK getText:', config.docText);
      return config.docText;
    }),
  },
};

interface Window {
  showInformationMessage: jest.Mock;
  showErrorMessage: jest.Mock;
  showWarningMessage: jest.Mock;
  activeTextEditor: any;
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

export interface Vscode {
  window: Window;
  workspace: Workspace;
}

const vscode: Vscode = {
  window,
  workspace,
};

export default vscode;
