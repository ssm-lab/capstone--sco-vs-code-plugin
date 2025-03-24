import * as vscode from 'vscode';
import * as fs from 'fs';
import { createHash } from 'crypto';
import { envConfig } from '../utils/envConfig';

/**
 * Manages caching of detected smells to avoid redundant backend calls.
 * This class handles storing, retrieving, and clearing cached smells.
 */
export class SmellsCacheManager {
  private cacheUpdatedEmitter = new vscode.EventEmitter<string>();
  public readonly onSmellsUpdated = this.cacheUpdatedEmitter.event;

  constructor(private context: vscode.ExtensionContext) {}

  private generateSmellId(smell: Smell): string {
    return createHash('sha256')
      .update(JSON.stringify(smell))
      .digest('hex')
      .substring(0, 5);
  }

  private generateFileHash(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    return createHash('sha256').update(content).digest('hex');
  }

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

    this.cacheUpdatedEmitter.fire(filePath);
  }

  public getCachedSmells(filePath: string): Smell[] | undefined {
    const fileHash = this.generateFileHash(filePath);
    const cache = this.getFullSmellCache();
    return cache[fileHash];
  }

  public hasCachedSmells(filePath: string): boolean {
    const fileHash = this.generateFileHash(filePath);
    const cache = this.getFullSmellCache();
    return cache[fileHash] !== undefined;
  }

  public getSmellById(id: string): Smell | undefined {
    const cache = this.getFullSmellCache();
    for (const hash in cache) {
      const smell = cache[hash].find((s) => s.id === id);
      if (smell) return smell;
    }
    return undefined;
  }

  public async clearCachedSmellsForFile(filePath: string): Promise<void> {
    const fileHash = this.generateFileHash(filePath);
    const cache = this.getFullSmellCache();
    const pathMap = this.getHashToPathMap();

    delete cache[fileHash];
    delete pathMap[fileHash];

    await this.context.workspaceState.update(envConfig.SMELL_CACHE_KEY!, cache);
    await this.context.workspaceState.update(envConfig.HASH_PATH_MAP_KEY!, pathMap);

    this.cacheUpdatedEmitter.fire(filePath);
  }

  public async clearCachedSmellsByPath(filePath: string): Promise<void> {
    const pathMap = this.getHashToPathMap();
    const hash = Object.keys(pathMap).find((h) => pathMap[h] === filePath);
    if (!hash) return;

    const cache = this.getFullSmellCache();
    delete cache[hash];
    delete pathMap[hash];

    await this.context.workspaceState.update(envConfig.SMELL_CACHE_KEY!, cache);
    await this.context.workspaceState.update(envConfig.HASH_PATH_MAP_KEY!, pathMap);

    this.cacheUpdatedEmitter.fire(filePath);
  }

  public getFullSmellCache(): Record<string, Smell[]> {
    return this.context.workspaceState.get<Record<string, Smell[]>>(
      envConfig.SMELL_CACHE_KEY!,
      {},
    );
  }

  public getHashToPathMap(): Record<string, string> {
    return this.context.workspaceState.get<Record<string, string>>(
      envConfig.HASH_PATH_MAP_KEY!,
      {},
    );
  }

  public async clearAllCachedSmells(): Promise<void> {
    await this.context.workspaceState.update(envConfig.SMELL_CACHE_KEY!, {});
    await this.context.workspaceState.update(envConfig.HASH_PATH_MAP_KEY!, {});

    this.cacheUpdatedEmitter.fire('all');
  }

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
      this.cacheUpdatedEmitter.fire(newPath);
      return true;
    }

    return false;
  }

  public getPreviousFilePathForHash(hash: string): string | undefined {
    const pathMap = this.getHashToPathMap();
    return pathMap[hash];
  }

  public getAllFilePaths(): string[] {
    const map = this.context.workspaceState.get<Record<string, string>>(
      envConfig.HASH_PATH_MAP_KEY!,
      {},
    );
    return Object.values(map);
  }
}
