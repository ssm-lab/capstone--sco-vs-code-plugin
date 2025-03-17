// test/mocks/contextManager-mock.ts
import * as vscode from 'vscode';

interface ContextStorage {
  globalState: Record<string, any>;
  workspaceState: Record<string, any>;
}

const contextStorage: ContextStorage = {
  globalState: {},
  workspaceState: {},
};

const mockExtensionContext: Partial<vscode.ExtensionContext> = {
  globalState: {
    get: jest.fn((key: string, defaultVal?: any) => {
      console.log(`MOCK getGlobalData: ${key}`);
      return contextStorage.globalState[key] ?? defaultVal;
    }),
    update: jest.fn(async (key: string, value: any) => {
      console.log(`MOCK setGlobalData: ${key}:${value}`);
      contextStorage.globalState[key] = value;
    }),
  } as any, // Casting to `any` to satisfy `vscode.ExtensionContext`
  workspaceState: {
    get: jest.fn((key: string, defaultVal?: any) => {
      console.log(`MOCK getWorkspaceData: ${key}`);
      return contextStorage.workspaceState[key] ?? defaultVal;
    }),
    update: jest.fn(async (key: string, value: any) => {
      console.log(`MOCK setWorkspaceData ${key}:${value}`);
      contextStorage.workspaceState[key] = value;
    }),
  } as any, // Casting to `any` to satisfy `vscode.ExtensionContext`
};

const mockContextManager = {
  context: mockExtensionContext as vscode.ExtensionContext,
  getGlobalData: jest.fn((key: string, defaultVal?: any) => {
    return contextStorage.globalState[key] ?? defaultVal;
  }),
  setGlobalData: jest.fn(async (key: string, value: any) => {
    contextStorage.globalState[key] = value;
  }),
  getWorkspaceData: jest.fn((key: string, defaultVal?: any) => {
    return contextStorage.workspaceState[key] ?? defaultVal;
  }),
  setWorkspaceData: jest.fn(async (key: string, value: any) => {
    contextStorage.workspaceState[key] = value;
  }),
};

export default mockContextManager;
