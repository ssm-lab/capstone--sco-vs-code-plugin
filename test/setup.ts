import mockEnvConfig from './mocks/env-config-mock';

jest.mock('vscode');

jest.mock('../src/utils/envConfig', () => ({
  envConfig: mockEnvConfig,
}));
