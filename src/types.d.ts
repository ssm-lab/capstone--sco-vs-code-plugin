export interface Occurrence {
  line: number;
  endLine?: number;
  column: number;
  endColumn?: number;
}

export interface AdditionalInfo {
  // CRC
  repetitions?: number;
  callString?: string;
  // SCL
  concatTarget?: string;
  innerLoopLine?: number;
}

export interface Smell {
  type: string; // Type of the smell (e.g., "performance", "convention")
  symbol: string; // Symbolic identifier for the smell (e.g., "cached-repeated-calls")
  message: string; // Detailed description of the smell
  messageId: string; // Unique ID for the smell
  confidence: string; // Confidence level (e.g., "HIGH", "MEDIUM")
  path: string; // Optional: absolute file path
  module: string; // Optional: Module name
  obj?: string; // Optional: Object name associated with the smell (if applicable)
  occurences: Occurrence[]; // Optional: List of occurrences for repeated calls
  additionalInfo: AdditionalInfo;
}

export interface ChangedFile {
  original: string;
  refactored: string;
}

export interface RefactoredData {
  tempDir: string;
  targetFile: ChangedFile;
  energySaved: number;
  affectedFiles: ChangedFile[];
}

export interface RefactorOutput {
  refactoredData?: RefactoredData; // Refactored code as a string
  updatedSmells: Smell[]; //
}

export interface ActiveDiff {
  files: ChangedFile[];
  isOpen: boolean;
  firstOpen: boolean;
}

export type SmellDetails = {
  symbol: string;
  message: string;
  colour: string; // RGB colour as a string
};
