import * as dotenv from 'dotenv';

dotenv.config();

export interface EnvConfig {
  SMELL_MAP_KEY?: string;
  FILE_CHANGES_KEY?: string;
  LAST_USED_SMELLS_KEY?: string;
}

export const envConfig: EnvConfig = {
  SMELL_MAP_KEY: process.env.SMELL_MAP_KEY,
  FILE_CHANGES_KEY: process.env.FILE_CHANGES_KEY,
  LAST_USED_SMELLS_KEY: process.env.LAST_USED_SMELLS_KEY
};
