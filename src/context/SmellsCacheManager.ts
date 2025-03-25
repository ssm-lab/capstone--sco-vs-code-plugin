import * as vscode from 'vscode';
import * as fs from 'fs';
import { createHash } from 'crypto';
import { envConfig } from '../utils/envConfig';
import { ecoOutput } from '../extension';

/**
 * Manages caching of detected smells to avoid redundant backend calls.
 * Uses workspace storage to persist cache between sessions.
 * Implements file content hashing for change detection and maintains
 * a bidirectional mapping between file paths and their content hashes.
 */
export class SmellsCacheManager {
  // Event emitter for cache update notifications
  private cacheUpdatedEmitter = new vscode.EventEmitter<string>();
  public readonly onSmellsUpdated = this.cacheUpdatedEmitter.event;

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Generates a stable identifier for a smell based on its properties
   * @param smell - The smell object to generate ID for
   * @returns Short SHA-256 hash (first 5 chars) of the serialized smell
   */
  private generateSmellId(smell: Smell): string {
    return createHash('sha256')
      .update(JSON.stringify(smell))
      .digest('hex')
      .substring(0, 5);
  }

  /**
   * Generates content hash for a file to detect changes
   * @param filePath - Absolute path to the file
   * @returns SHA-256 hash of file content
   */
  private generateFileHash(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Stores smells in cache for specified file
   * @param filePath - File path to associate with smells
   * @param smells - Array of smell objects to cache
   */
  public async setCachedSmells(filePath: string, smells: Smell[]): Promise<void> {
    const cache = this.getFullSmellCache();
    const pathMap = this.getHashToPathMap();

    const normalizedPath = vscode.Uri.file(filePath).fsPath;
    const fileHash = this.generateFileHash(normalizedPath);

    // Augment smells with stable identifiers
    const smellsWithIds = smells.map((smell) => ({
      ...smell,
      id: this.generateSmellId(smell),
    }));

    cache[fileHash] = smellsWithIds;
    pathMap[fileHash] = normalizedPath;

    await this.context.workspaceState.update(envConfig.SMELL_CACHE_KEY!, cache);
    await this.context.workspaceState.update(envConfig.HASH_PATH_MAP_KEY!, pathMap);

    this.cacheUpdatedEmitter.fire(filePath);
  }

  /**
   * Retrieves cached smells for a file
   * @param filePath - File path to look up in cache
   * @returns Array of smells or undefined if not found
   */
  public getCachedSmells(filePath: string): Smell[] | undefined {
    const normalizedPath = vscode.Uri.file(filePath).fsPath;
    const fileHash = this.generateFileHash(normalizedPath);
    const cache = this.getFullSmellCache();
    return cache[fileHash];
  }

  /**
   * Checks if smells exist in cache for a file
   * @param filePath - File path to check
   * @returns True if file has cached smells
   */
  public hasCachedSmells(filePath: string): boolean {
    const normalizedPath = vscode.Uri.file(filePath).fsPath;
    const fileHash = this.generateFileHash(normalizedPath);
    const cache = this.getFullSmellCache();
    return cache[fileHash] !== undefined;
  }

  /**
   * Clears cache for a file by its current content hash
   * @param filePath - File path to clear from cache
   */
  public async clearCachedSmellsForFile(filePath: string): Promise<void> {
    const normalizedPath = vscode.Uri.file(filePath).fsPath;
    const fileHash = this.generateFileHash(normalizedPath);
    const cache = this.getFullSmellCache();
    const pathMap = this.getHashToPathMap();

    delete cache[fileHash];
    delete pathMap[fileHash];

    await this.context.workspaceState.update(envConfig.SMELL_CACHE_KEY!, cache);
    await this.context.workspaceState.update(envConfig.HASH_PATH_MAP_KEY!, pathMap);

    this.cacheUpdatedEmitter.fire(normalizedPath);
  }

  /**
   * Clears cache for a file by path (regardless of current content hash)
   * @param filePath - File path to clear from cache
   */
  public async clearCachedSmellsByPath(filePath: string): Promise<void> {
    const pathMap = this.getHashToPathMap();
    const normalizedPath = vscode.Uri.file(filePath).fsPath;
    const hash = Object.keys(pathMap).find((h) => pathMap[h] === normalizedPath);
    if (!hash) return;

    const cache = this.getFullSmellCache();
    delete cache[hash];
    delete pathMap[hash];

    await this.context.workspaceState.update(envConfig.SMELL_CACHE_KEY!, cache);
    await this.context.workspaceState.update(envConfig.HASH_PATH_MAP_KEY!, pathMap);

    this.cacheUpdatedEmitter.fire(normalizedPath);
  }

  /**
   * Retrieves complete smell cache
   * @returns Object mapping file hashes to smell arrays
   */
  public getFullSmellCache(): Record<string, Smell[]> {
    return this.context.workspaceState.get<Record<string, Smell[]>>(
      envConfig.SMELL_CACHE_KEY!,
      {},
    );
  }

  /**
   * Retrieves hash-to-path mapping
   * @returns Object mapping file hashes to original paths
   */
  public getHashToPathMap(): Record<string, string> {
    return this.context.workspaceState.get<Record<string, string>>(
      envConfig.HASH_PATH_MAP_KEY!,
      {},
    );
  }

  /**
   * Clears entire smell cache
   */
  public async clearAllCachedSmells(): Promise<void> {
    await this.context.workspaceState.update(envConfig.SMELL_CACHE_KEY!, {});
    await this.context.workspaceState.update(envConfig.HASH_PATH_MAP_KEY!, {});

    this.cacheUpdatedEmitter.fire('all');
  }

  /**
   * Retrieves all file paths currently in cache
   * @returns Array of cached file paths
   */
  public getAllFilePaths(): string[] {
    const map = this.context.workspaceState.get<Record<string, string>>(
      envConfig.HASH_PATH_MAP_KEY!,
      {},
    );
    return Object.values(map);
  }

  /**
   * Checks if a file has any cache entries (current or historical)
   * @param filePath - File path to check
   * @returns True if file exists in cache metadata
   */
  public hasFileInCache(filePath: string): boolean {
    const pathMap = this.getHashToPathMap();
    const normalizedPath = vscode.Uri.file(filePath).fsPath;
    const fileExistsInCache = Object.values(pathMap).includes(normalizedPath);

    ecoOutput.appendLine(
      `[SmellCacheManager] Path existence check for ${normalizedPath}: ` +
        `${fileExistsInCache ? 'EXISTS' : 'NOT FOUND'} in cache`,
    );

    return fileExistsInCache;
  }
}
