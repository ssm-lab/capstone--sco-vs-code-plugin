import * as vscode from 'vscode';
import { createHash } from 'crypto';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { envConfig } from '../utils/envConfig';

/**
 * Manages caching of detected smells and file hashes to avoid redundant backend calls.
 * This class handles storing, retrieving, and clearing cached smells and file hashes,
 * as well as refreshing the UI when the cache is updated.
 */
export class SmellsCacheManager {
  private cacheUpdatedEmitter = new vscode.EventEmitter<string>();
  public readonly onSmellsUpdated = this.cacheUpdatedEmitter.event;

  constructor(private context: vscode.ExtensionContext) {}

  // ============================
  // Smell Caching Methods
  // ============================

  /**
   * Generates a unique string ID for a smell based on its content.
   * The ID is derived from a SHA256 hash of the smell object.
   *
   * @param smell - The smell object to generate an ID for.
   * @returns A unique string ID for the smell.
   */
  private generateSmellId(smell: Smell): string {
    // Generate a SHA256 hash of the smell object
    const smellHash = createHash('sha256')
      .update(JSON.stringify(smell))
      .digest('hex');

    // Use the first 8 characters of the hash as the ID
    return smellHash.substring(0, 3);
  }

  /**
   * Caches detected smells for a given file and assigns unique string IDs to each smell.
   * The smells are stored in the workspace state for persistence.
   *
   * @param filePath - The absolute path of the file.
   * @param smells - The detected smells to store.
   */
  public async setCachedSmells(filePath: string, smells: Smell[]): Promise<void> {
    const cache = this.getFullSmellCache();

    // Assign unique string IDs to each smell
    const smellsWithIds = smells.map((smell) => {
      const id = this.generateSmellId(smell);
      return {
        ...smell,
        id, // Add the unique string ID to the smell object
      };
    });

    // Update the cache with the new smells
    cache[filePath] = smellsWithIds;
    await this.context.workspaceState.update(envConfig.SMELL_CACHE_KEY!, cache);

    this.cacheUpdatedEmitter.fire(filePath);
  }

  /**
   * Retrieves cached smells for a given file.
   *
   * @param filePath - The absolute path of the file.
   * @returns An array of detected smells with unique IDs, or undefined if no smells are cached.
   */
  public getCachedSmells(filePath: string): Smell[] | undefined {
    const cache = this.getFullSmellCache();
    return cache[filePath];
  }

  /**
   * Retrieves a smell by its unique string ID.
   *
   * @param id - The unique string ID of the smell.
   * @returns The smell object, or undefined if no smell matches the ID.
   */
  public getSmellById(id: string): Smell | undefined {
    const cache = this.getFullSmellCache();
    for (const filePath in cache) {
      const smells = cache[filePath];
      const smell = smells.find((s) => s.id === id);
      if (smell) {
        return smell;
      }
    }
    return undefined;
  }

  /**
   * Clears all cached smells from the workspace state.
   * This forces a fresh analysis of all files when `detectSmellsFile` is called.
   */
  public async clearSmellsCache(): Promise<void> {
    await this.context.workspaceState.update(envConfig.SMELL_CACHE_KEY!, undefined);

    this.cacheUpdatedEmitter.fire('all');
  }

  /**
   * Clears cached smells for a specific file.
   *
   * @param filePath - The path of the file to clear.
   */
  public async clearCachedSmellsForFile(filePath: string): Promise<void> {
    const cache = this.getFullSmellCache();
    delete cache[filePath];
    await this.context.workspaceState.update(envConfig.SMELL_CACHE_KEY!, cache);

    this.cacheUpdatedEmitter.fire(filePath);
  }

  /**
   * Retrieves the entire smell cache from the workspace state.
   *
   * @returns A record of file paths to their corresponding cached smells.
   */
  public getFullSmellCache(): Record<string, Smell[]> {
    return this.context.workspaceState.get<Record<string, Smell[]>>(
      envConfig.SMELL_CACHE_KEY!,
      {},
    );
  }

  // ============================
  // File Hash Caching Methods
  // ============================

  /**
   * Computes a SHA256 hash of a file's contents and returns it as a string.
   *
   * @param content - The file content as a string.
   * @returns A SHA256 hash string derived from the file content.
   */
  public computeFileHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Stores a hash of a file's contents in the workspace state.
   *
   * @param filePath - The absolute path of the file.
   * @param content - The file content to hash.
   */
  public async storeFileHash(filePath: string, content: string): Promise<void> {
    const hashes = this.getFullFileHashCache();
    hashes[filePath] = this.computeFileHash(content);
    await this.context.workspaceState.update(envConfig.FILE_HASH_CACHE_KEY!, hashes);
  }

  /**
   * Retrieves the stored hash for a given file.
   *
   * @param filePath - The absolute path of the file.
   * @returns The stored hash as a string, or undefined if no hash is found.
   */
  public getStoredFileHash(filePath: string): string | undefined {
    const hashes = this.getFullFileHashCache();
    return hashes[filePath];
  }

  /**
   * Retrieves the entire file hash cache from the workspace state.
   *
   * @returns A record of file paths to their corresponding SHA256 hashes.
   */
  private getFullFileHashCache(): Record<string, string> {
    return this.context.workspaceState.get<Record<string, string>>(
      envConfig.FILE_HASH_CACHE_KEY!,
      {},
    );
  }

  // ============================
  // UI Refresh Methods
  // ============================

  /**
   * Clears all cached smells and refreshes the UI.
   * This method is used by both "Clear Smells Cache" and "Reset Configuration" commands.
   *
   * @param smellsDisplayProvider - The tree view provider responsible for the UI.
   */
  public async clearCacheAndRefreshUI(
    smellsDisplayProvider: SmellsViewProvider,
  ): Promise<void> {
    // Remove all cached smells from the workspace state
    await this.clearSmellsCache();

    // Reset the UI state, including icons and dropdowns
    smellsDisplayProvider.resetAllSmells();

    // Refresh the UI to reflect the cleared cache
    smellsDisplayProvider.refresh();
  }
}
