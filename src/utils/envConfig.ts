import * as dotenv from 'dotenv';

dotenv.config();

export interface EnvConfig {
  SERVER_URL?: string;
  SMELL_CACHE_KEY?: string;
  FILE_HASH_CACHE_KEY?: string;
}

export const envConfig: EnvConfig = {
  SERVER_URL: process.env.SERVER_URL,
  SMELL_CACHE_KEY: process.env.SMELL_CACHE_KEY,
  FILE_HASH_CACHE_KEY: process.env.FILE_HASH_CACHE_KEY,
};
