/**
 * Normalizes file paths for consistent comparison and caching
 * @param filePath - The file path to normalize
 * @returns Lowercase version of the path for case-insensitive operations
 */
export function normalizePath(filePath: string): string {
  return filePath.toLowerCase();
}
