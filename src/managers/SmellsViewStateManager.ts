import * as path from 'path';

interface DetectedSmell {
  messageId: string;
  symbol: string;
  occurences: { line: number; endLine?: number }[];
}

interface ProcessedSmell {
  acronym: string;
  occurrences: { line: number; endLine?: number }[];
}

export class SmellsStateManager {
  private fileStatusMap: Map<string, string> = new Map();
  private detectedSmells: Map<string, ProcessedSmell[]> = new Map();
  private smellToFileMap: Map<string, string> = new Map();
  private modifiedFiles: Map<string, boolean> = new Map();

  /**
   * Updates the detected smells for a file.
   * @param filePath - The analyzed file path.
   * @param smells - The detected smells in the file.
   * @param smellMetadata - Metadata containing message ID and acronym for each smell.
   */
  updateSmells(
    filePath: string,
    smells: DetectedSmell[],
    smellMetadata: Record<string, { message_id: string; acronym: string }>,
  ): void {
    this.fileStatusMap.set(filePath, 'passed');

    const formattedSmells: ProcessedSmell[] = smells.map((smell) => {
      const foundEntry = Object.values(smellMetadata).find(
        (smellData) => smellData.message_id === smell.messageId,
      ) as { message_id: string; acronym: string };

      return {
        acronym: foundEntry ? foundEntry.acronym : smell.messageId,
        occurrences: smell.occurences.map((occ) => ({
          line: occ.line,
          endLine: occ.endLine,
        })),
      };
    });

    this.detectedSmells.set(filePath, formattedSmells);

    const folderPath = path.dirname(filePath);
    if (!this.detectedSmells.has(folderPath)) {
      this.detectedSmells.set(folderPath, []);
    }
    this.detectedSmells.get(folderPath)?.push(...formattedSmells);
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
  getSmellsForFile(filePath: string): ProcessedSmell[] {
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
