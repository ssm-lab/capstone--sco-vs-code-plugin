import * as dotenv from 'dotenv';

dotenv.config();

export interface EnvConfig {
  SERVER_URL?: string;
  SMELL_CACHE_KEY?: string;
  HASH_PATH_MAP_KEY?: string;
  WORKSPACE_METRICS_DATA?: string;
}

export const envConfig: EnvConfig = {
  SERVER_URL: process.env.SERVER_URL,
  SMELL_CACHE_KEY: process.env.SMELL_CACHE_KEY,
  HASH_PATH_MAP_KEY: process.env.FILE_HASH_CACHE_KEY,
  WORKSPACE_METRICS_DATA: process.env.WORKSPACE_METRICS_DATA,
};
