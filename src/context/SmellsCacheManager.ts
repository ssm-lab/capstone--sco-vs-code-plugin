import * as vscode from 'vscode';
import { createHash } from 'crypto';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { envConfig } from '../utils/envConfig';

/**
 * Manages caching of detected smells and file hashes to avoid redundant backend calls.
 */
export class SmellsCacheManager {
  constructor(private context: vscode.ExtensionContext) {}

  // ============================
  // Smell Caching Methods
  // ============================

  /**
   * Retrieves cached smells for a given file.
   * If the file has been analyzed and found clean, this will return an empty array.
   *
   * @param filePath - The absolute path of the file.
   * @returns An array of detected smells or `undefined` if the file has not been analyzed.
   */
  public getCachedSmells(filePath: string): Smell[] | undefined {
    const cache = this.getFullSmellCache();
    return cache[filePath]; // May be undefined
  }

  /**
   * Caches detected smells for a given file.
   * If no smells are detected, caches an empty array to avoid redundant backend calls.
   *
   * @param filePath - The absolute path of the file.
   * @param smells - The detected smells to store (empty array if no smells found).
   */
  public async setCachedSmells(filePath: string, smells: Smell[]): Promise<void> {
    const cache = this.getFullSmellCache();
    cache[filePath] = smells;
    await this.context.workspaceState.update(envConfig.SMELL_CACHE_KEY!, cache);
  }

  /**
   * Clears all cached smells from the workspace.
   * This forces a fresh analysis of all files when `detectSmellsFile` is called.
   */
  public async clearSmellsCache(): Promise<void> {
    await this.context.workspaceState.update(envConfig.SMELL_CACHE_KEY!, undefined);
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
  }

  /**
   * Retrieves the entire smell cache.
   * @returns A record of file paths to cached smells.
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
   * Computes a SHA256 hash of a file's contents.
   * @param content - The file content as a string.
   * @returns A SHA256 hash string.
   */
  public computeFileHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Stores a hash of a file's contents in workspaceState.
   * @param filePath - Absolute path of the file.
   * @param hash - The computed file hash.
   */
  public async storeFileHash(filePath: string, hash: string): Promise<void> {
    const hashes = this.getFullFileHashCache();
    hashes[filePath] = hash;
    await this.context.workspaceState.update(envConfig.FILE_HASH_CACHE_KEY!, hashes);
  }

  /**
   * Retrieves the stored hash for a given file.
   * @param filePath - Absolute path of the file.
   * @returns The stored hash or undefined if not found.
   */
  public getStoredFileHash(filePath: string): string | undefined {
    const hashes = this.getFullFileHashCache();
    return hashes[filePath];
  }

  /**
   * Retrieves the entire file hash cache.
   * @returns A record of file paths to SHA256 hashes.
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
   * Used by both "Clear Smells Cache" and "Reset Configuration".
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
