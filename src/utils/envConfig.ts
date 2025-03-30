export interface EnvConfig {
  SERVER_URL?: string;
  SMELL_CACHE_KEY?: string;
  HASH_PATH_MAP_KEY?: string;
  WORKSPACE_METRICS_DATA?: string;
  WORKSPACE_CONFIGURED_PATH?: string;
  UNFINISHED_REFACTORING?: string;
}

export const envConfig: EnvConfig = {
  SERVER_URL: '127.0.0.1:8000',
  SMELL_CACHE_KEY: 'smellCacheKey',
  HASH_PATH_MAP_KEY: 'hashMapKey',
  WORKSPACE_METRICS_DATA: 'workspaceMetrics',
  WORKSPACE_CONFIGURED_PATH: 'workspacePath',
  UNFINISHED_REFACTORING: 'pastRefactor',
};
