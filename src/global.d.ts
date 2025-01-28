export {};

// global.d.ts
export {};

declare global {
  // Define your global types here
  interface Occurrence {
    line: number;
    endLine?: number;
    column: number;
    endColumn?: number;
  }

  interface Smell {
    type: string; // Type of the smell (e.g., "performance", "convention")
    symbol: string; // Symbolic identifier for the smell (e.g., "cached-repeated-calls")
    message: string; // Detailed description of the smell
    messageId: string; // Unique ID for the smell
    confidence: string; // Confidence level (e.g., "HIGH", "MEDIUM")
    path: string; // Optional: absolute file path
    module: string; // Optional: Module name
    obj: string; // Optional: Object name associated with the smell (if applicable)
    occurences: Occurrence[]; // Optional: List of occurrences for repeated calls
    additionalInfo?: any;
  }

  interface RefactoredData {
    temp_dir: string;
    targetFile: string;
    energySaved: number;
    refactoredFiles: string[];
  }

  interface RefactorOutput {
    refactoredData: RefactoredData; // Refactored code as a string
    updatedSmells: Smell[]; //
  }
}
