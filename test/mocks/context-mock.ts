// test/mocks/contextManager-mock.ts
interface ContextStorage {
  globalState: Record<string, any>;
  workspaceState: Record<string, any>;
}

const contextStorage: ContextStorage = {
  globalState: {},
  workspaceState: {},
};

const mockExtensionContext = {
  globalState: {
    get: jest.fn((key: string, defaultVal?: any) => {
      return contextStorage.globalState[key] ?? defaultVal;
    }),
    update: jest.fn(async (key: string, value: any) => {
      contextStorage.globalState[key] = value;
    }),
  } as any,
  workspaceState: {
    get: jest.fn((key: string, defaultVal?: any) => {
      return contextStorage.workspaceState[key] ?? defaultVal;
    }),
    update: jest.fn(async (key: string, value: any) => {
      contextStorage.workspaceState[key] = value;
    }),
  } as any,
};

export default mockExtensionContext;
