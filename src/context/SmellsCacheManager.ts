import * as vscode from 'vscode';
import * as fs from 'fs';
import { createHash } from 'crypto';
import { envConfig } from '../utils/envConfig';

/**
 * Manages caching of detected smells to avoid redundant backend calls.
 * This class handles storing, retrieving, and clearing cached smells.
 */
export class SmellsCacheManager {
  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Generates a unique 5-character ID for a smell based on its content.
   * @param smell - The smell object to generate an ID for.
   * @returns A unique 5-character hash ID.
   */
  private generateSmellId(smell: Smell): string {
    return createHash('sha256')
      .update(JSON.stringify(smell))
      .digest('hex')
      .substring(0, 5);
  }

  /**
   * Generates a hash of the file contents.
   * @param filePath - The absolute path to the file.
   * @returns A SHA-256 hash of the file's content.
   */
  private generateFileHash(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Caches smells based on the content hash of the file and maps the hash to the file path.
   * @param filePath - The path of the file being cached.
   * @param smells - The list of smells to cache.
   */
  public async setCachedSmells(filePath: string, smells: Smell[]): Promise<void> {
    const cache = this.getFullSmellCache();
    const pathMap = this.getHashToPathMap();
    const fileHash = this.generateFileHash(filePath);

    const smellsWithIds = smells.map((smell) => ({
      ...smell,
      id: this.generateSmellId(smell),
    }));

    cache[fileHash] = smellsWithIds;
    pathMap[fileHash] = filePath;

    await this.context.workspaceState.update(envConfig.SMELL_CACHE_KEY!, cache);
    await this.context.workspaceState.update(envConfig.HASH_PATH_MAP_KEY!, pathMap);
  }

  /**
   * Retrieves cached smells for a given file by hashing its contents.
   * @param filePath - The path of the file to retrieve cached smells for.
   * @returns The cached smells for the file, or `undefined` if not found.
   */
  public getCachedSmells(filePath: string): Smell[] | undefined {
    const fileHash = this.generateFileHash(filePath);
    const cache = this.getFullSmellCache();
    return cache[fileHash];
  }

  /**
   * Checks if a file has cached smells by checking its content hash.
   * @param filePath - The path of the file to check.
   * @returns `true` if the file has cached smells, otherwise `false`.
   */
  public hasCachedSmells(filePath: string): boolean {
    const fileHash = this.generateFileHash(filePath);
    const cache = this.getFullSmellCache();
    return cache[fileHash] !== undefined;
  }

  /**
   * Retrieves a smell by its ID from any file in the cache.
   * @param id - The ID of the smell to retrieve.
   * @returns The smell object if found, otherwise `undefined`.
   */
  public getSmellById(id: string): Smell | undefined {
    const cache = this.getFullSmellCache();
    for (const hash in cache) {
      const smell = cache[hash].find((s) => s.id === id);
      if (smell) return smell;
    }
    return undefined;
  }

  /**
   * Clears cached smells for a file by its content hash.
   * @param filePath - The path of the file to clear cached smells for.
   */
  public async clearCachedSmellsForFile(filePath: string): Promise<void> {
    const fileHash = this.generateFileHash(filePath);
    const cache = this.getFullSmellCache();
    const pathMap = this.getHashToPathMap();

    delete cache[fileHash];
    delete pathMap[fileHash];

    await this.context.workspaceState.update(envConfig.SMELL_CACHE_KEY!, cache);
    await this.context.workspaceState.update(envConfig.HASH_PATH_MAP_KEY!, pathMap);
  }

  /**
   * Clears cached smells for a file by its path.
   * @param filePath - The path of the file to clear cached smells for.
   */
  public async clearCachedSmellsByPath(filePath: string): Promise<void> {
    const pathMap = this.getHashToPathMap();
    const hash = Object.keys(pathMap).find((h) => pathMap[h] === filePath);
    if (!hash) return;

    const cache = this.getFullSmellCache();
    delete cache[hash];
    delete pathMap[hash];

    await this.context.workspaceState.update(envConfig.SMELL_CACHE_KEY!, cache);
    await this.context.workspaceState.update(envConfig.HASH_PATH_MAP_KEY!, pathMap);
  }

  /**
   * Retrieves the entire smell cache.
   * @returns A record mapping file hashes to their cached smells.
   */
  public getFullSmellCache(): Record<string, Smell[]> {
    return this.context.workspaceState.get<Record<string, Smell[]>>(
      envConfig.SMELL_CACHE_KEY!,
      {},
    );
  }

  /**
   * Retrieves the hash-to-file-path map.
   * @returns A record mapping file hashes to their file paths.
   */
  public getHashToPathMap(): Record<string, string> {
    return this.context.workspaceState.get<Record<string, string>>(
      envConfig.HASH_PATH_MAP_KEY!,
      {},
    );
  }

  /**
   * Clears all cached smells and the hash-to-path map.
   */
  public async clearAllCachedSmells(): Promise<void> {
    await this.context.workspaceState.update(envConfig.SMELL_CACHE_KEY!, {});
    await this.context.workspaceState.update(envConfig.HASH_PATH_MAP_KEY!, {});
  }

  /**
   * Reassociates a cached file hash with a new file path.
   * @param hash - The hash of the file to reassociate.
   * @param newPath - The new file path to associate with the hash.
   * @returns `true` if the reassociation was successful, otherwise `false`.
   */
  public async reassociateCacheFromHash(
    hash: string,
    newPath: string,
  ): Promise<boolean> {
    const cache = this.getFullSmellCache();
    const pathMap = this.getHashToPathMap();

    if (cache[hash]) {
      pathMap[hash] = newPath;
      await this.context.workspaceState.update(
        envConfig.HASH_PATH_MAP_KEY!,
        pathMap,
      );
      return true;
    }

    return false;
  }

  /**
   * Retrieves the previous file path associated with a hash.
   * @param hash - The hash to look up.
   * @returns The file path associated with the hash, or `undefined` if not found.
   */
  public getPreviousFilePathForHash(hash: string): string | undefined {
    const pathMap = this.getHashToPathMap();
    return pathMap[hash];
  }

  /**
   * Retrieves all file paths currently in the cache.
   * @returns An array of file paths.
   */
  public getAllFilePaths(): string[] {
    const map = this.context.workspaceState.get<Record<string, string>>(
      envConfig.HASH_PATH_MAP_KEY!,
      {},
    );
    return Object.values(map);
  }
}
