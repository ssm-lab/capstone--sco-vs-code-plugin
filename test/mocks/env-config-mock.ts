import { envConfig, EnvConfig } from '../../src/utils/envConfig';

jest.mock('../../src/utils/envConfig', () => {
  const mockEnvConfig: EnvConfig = {
    SERVER_URL: 'server-url',
    SMELL_MAP_KEY: 'smell-map-key',
    FILE_CHANGES_KEY: 'file-changes-key',
    LAST_USED_SMELLS_KEY: 'last-used-smells-key',
    CURRENT_REFACTOR_DATA_KEY: 'current-refactor-data-key',
    ACTIVE_DIFF_KEY: 'active-diff-key',
  };

  return { envConfig: mockEnvConfig };
});

export { envConfig };
