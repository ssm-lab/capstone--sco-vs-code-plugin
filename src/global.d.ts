export {};

/**
 * Global type declarations for the Eco-Optimizer extension.
 * These interfaces define the core data structures used throughout the application.
 */
declare global {
  /**
   * Represents a specific location in source code where a smell occurs.
   * Uses VS Code-style line/column numbering (1-based).
   */
  export interface Occurrence {
    /** The starting line number (1-based) */
    line: number;
    /** The ending line number (1-based, optional) */
    endLine?: number;
    /** The starting column number (1-based) */
    column: number;
    /** The ending column number (1-based, optional) */
    endColumn?: number;
  }
  
  /**
   * Additional context-specific information about a code smell.
   * The fields vary depending on the smell type.
   */
  export interface AdditionalInfo {
    // Fields for Cached Repeated Calls (CRC) smell:
    /** Number of repetitions found (for CRC smells) */
    repetitions?: number;
    /** The call string that's being repeated (for CRC smells) */
    callString?: string;
    
    // Fields for String Concatenation in Loop (SCL) smell:
    /** The target variable being concatenated (for SCL smells) */
    concatTarget?: string;
    /** The line number where the inner loop occurs (for SCL smells) */
    innerLoopLine?: number;
  }
  
  /**
   * Represents a detected code smell with all its metadata.
   * This is the core data structure for analysis results.
   */
  export interface Smell {
    /** Category of the smell (e.g., "performance", "convention") */
    type: string;
    /** Unique identifier for the smell type (e.g., "cached-repeated-calls") */
    symbol: string;
    /** Human-readable description of the smell */
    message: string;
    /** Unique message ID for specific smell variations */
    messageId: string;
    /** Confidence level in detection ("HIGH", "MEDIUM", "LOW") */
    confidence: string;
    /** Absolute path to the file containing the smell */
    path: string;
    /** Module or namespace where the smell was found */
    module: string;
    /** Specific object/function name (when applicable) */
    obj?: string;
    /** All detected locations of this smell in the code */
    occurences: Occurrence[];
    /** Type-specific additional information about the smell */
    additionalInfo: AdditionalInfo;
    /** Unique identifier for this specific smell instance */
    id?: string;
  }

  /**
   * Represents the response from the backend refactoring service.
   * Contains all necessary information to present and apply refactorings.
   */
  export interface RefactoredData {
    /** Temporary directory containing all refactored files */
    tempDir: string;
    /** The main file that was refactored */
    targetFile: {
      /** Path to the original version */
      original: string;
      /** Path to the refactored version */
      refactored: string;
    };
    /** Estimated energy savings in joules (optional) */
    energySaved?: number;
    /** Any additional files affected by the refactoring */
    affectedFiles: {
      /** Path to the original version */
      original: string;
      /** Path to the refactored version */
      refactored: string;
    }[];
  }
}

export interface RefactorArtifacts {
  refactoredData: RefactoredData;
  smell: Smell;
}