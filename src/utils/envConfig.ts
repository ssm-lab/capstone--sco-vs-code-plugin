import * as dotenv from 'dotenv';

dotenv.config();

export interface EnvConfig {
  SERVER_URL?: string;
  SMELL_MAP_KEY?: string;
  FILE_CHANGES_KEY?: string;
  LAST_USED_SMELLS_KEY?: string;
  CURRENT_REFACTOR_DATA_KEY?: string;
  SMELL_CACHE_KEY?: string;
  FILE_HASH_CACHE_KEY?: string;
  ACTIVE_DIFF_KEY?: string;
  SMELL_LINTING_ENABLED_KEY?: string;
}

export const envConfig: EnvConfig = {
  SERVER_URL: process.env.SERVER_URL,
  SMELL_MAP_KEY: process.env.SMELL_MAP_KEY,
  FILE_CHANGES_KEY: process.env.FILE_CHANGES_KEY,
  LAST_USED_SMELLS_KEY: process.env.LAST_USED_SMELLS_KEY,
  CURRENT_REFACTOR_DATA_KEY: process.env.CURRENT_REFACTOR_DATA_KEY,
  ACTIVE_DIFF_KEY: process.env.ACTIVE_DIFF_KEY,
  SMELL_LINTING_ENABLED_KEY: process.env.SMELL_LINTING_ENABLED_KEY,
};
