import * as path from 'path';

export class SmellsStateManager {
  private fileStatusMap: Map<string, string> = new Map();
  private detectedSmells: Map<string, Smell[]> = new Map(); // Use Smell[] instead of ProcessedSmell[]
  private smellToFileMap: Map<string, string> = new Map();
  private modifiedFiles: Map<string, boolean> = new Map();

  /**
   * Updates the detected smells for a file.
   * @param filePath - The analyzed file path.
   * @param smells - The detected smells in the file.
   */
  updateSmells(filePath: string, smells: Smell[]): void {
    this.fileStatusMap.set(filePath, 'passed');

    // Update the detected smells for the file
    this.detectedSmells.set(filePath, smells);

    // Update the detected smells for the folder
    const folderPath = path.dirname(filePath);
    if (!this.detectedSmells.has(folderPath)) {
      this.detectedSmells.set(folderPath, []);
    }
    this.detectedSmells.get(folderPath)?.push(...smells);
  }

  /**
   * Marks a file as outdated.
   * @param filePath - The path of the modified file.
   */
  markFileAsOutdated(filePath: string): void {
    this.modifiedFiles.set(filePath, true);
  }

  /**
   * Clears the outdated status for a file.
   * @param filePath - The path of the file to clear.
   */
  clearOutdatedStatus(filePath: string): void {
    this.modifiedFiles.delete(filePath);
  }

  /**
   * Updates the status of a specific file or folder.
   * @param filePath - The file or folder path.
   * @param status - The new status to set.
   */
  updateFileStatus(filePath: string, status: string): void {
    this.fileStatusMap.set(filePath, status);
  }

  /**
   * Checks if a file is marked as outdated.
   * @param filePath - The path of the file to check.
   * @returns `true` if the file is outdated, `false` otherwise.
   */
  isFileOutdated(filePath: string): boolean {
    return this.modifiedFiles.has(filePath);
  }

  /**
   * Clears all detected smells and resets file statuses.
   */
  resetAllSmells(): void {
    this.detectedSmells.clear();
    this.fileStatusMap.clear();
    this.modifiedFiles.clear();
  }

  /**
   * Retrieves the status of a file.
   * @param filePath - The path of the file.
   * @returns The status of the file.
   */
  getFileStatus(filePath: string): string {
    return this.fileStatusMap.get(filePath) || 'not_detected';
  }

  /**
   * Retrieves the detected smells for a file.
   * @param filePath - The path of the file.
   * @returns An array of smell entries.
   */
  getSmellsForFile(filePath: string): Smell[] {
    return this.detectedSmells.get(filePath) || [];
  }

  /**
   * Maps a smell description to a file path.
   * @param smellDescription - The description of the smell.
   * @param filePath - The path of the file.
   */
  mapSmellToFile(smellDescription: string, filePath: string): void {
    this.smellToFileMap.set(smellDescription, filePath);
  }

  /**
   * Retrieves the file path for a smell description.
   * @param smellDescription - The description of the smell.
   * @returns The file path, or `undefined` if not found.
   */
  getFileForSmell(smellDescription: string): string | undefined {
    return this.smellToFileMap.get(smellDescription);
  }
}
