import * as vscode from 'vscode';
import { createHash } from 'crypto';
import { envConfig } from '../utils/envConfig';

/**
 * Manages caching of detected smells to avoid redundant backend calls.
 * This class handles storing, retrieving, and clearing cached smells.
 */
export class SmellsCacheManager {
  constructor(private context: vscode.ExtensionContext) {}

  // ============================
  // Smell Caching Methods
  // ============================

  /**
   * Generates a unique 5-character ID for a smell based on its content.
   * The ID is derived from a SHA256 hash of the smell object.
   *
   * @param smell - The smell object to generate an ID for.
   * @returns A unique 5-character string ID.
   */
  private generateSmellId(smell: Smell): string {
    // Generate a SHA256 hash of the smell object
    const smellHash = createHash('sha256')
      .update(JSON.stringify(smell))
      .digest('hex');

    // Use the first 5 characters of the hash as the ID
    return smellHash.substring(0, 5);
  }

  /**
   * Caches detected smells for a given file and assigns unique IDs to each smell.
   * @param filePath - The absolute path of the file.
   * @param smells - The detected smells to store.
   */
  public async setCachedSmells(filePath: string, smells: Smell[]): Promise<void> {
    const cache = this.getFullSmellCache();

    // Assign unique IDs to each smell
    const smellsWithIds = smells.map((smell) => ({
      ...smell,
      id: this.generateSmellId(smell), // Add a unique 5-character ID
    }));

    // Update the cache with the new smells
    cache[filePath] = smellsWithIds;
    await this.context.workspaceState.update(envConfig.SMELL_CACHE_KEY!, cache);
  }

  /**
   * Retrieves cached smells for a given file.
   * @param filePath - The absolute path of the file.
   * @returns An array of detected smells with unique IDs, or undefined if no smells are cached.
   */
  public getCachedSmells(filePath: string): Smell[] | undefined {
    const cache = this.getFullSmellCache();
    return cache[filePath];
  }

  /**
   * Checks if a file has cached smells.
   * @param filePath - The absolute path of the file.
   * @returns `true` if the file has cached smells, `false` otherwise.
   */
  public hasCachedSmells(filePath: string): boolean {
    const cache = this.getFullSmellCache();
    return cache[filePath] !== undefined;
  }

  /**
   * Retrieves a smell by its unique ID.
   * @param id - The unique ID of the smell.
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
   * Clears cached smells for a specific file.
   * @param filePath - The path of the file to clear.
   */
  public async clearCachedSmellsForFile(filePath: string): Promise<void> {
    const cache = this.getFullSmellCache();
    delete cache[filePath];
    await this.context.workspaceState.update(envConfig.SMELL_CACHE_KEY!, cache);
  }

  /**
   * Retrieves the entire smell cache from the workspace state.
   * @returns A record of file paths to their corresponding cached smells.
   */
  public getFullSmellCache(): Record<string, Smell[]> {
    return this.context.workspaceState.get<Record<string, Smell[]>>(
      envConfig.SMELL_CACHE_KEY!,
      {},
    );
  }

  public async clearAllCachedSmells(): Promise<void> {
    await this.context.workspaceState.update(envConfig.SMELL_CACHE_KEY!, {});
  }
}
