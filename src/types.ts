interface Occurrence {
    line: number;
    column: number;
    call_string: string;
}

export interface Smell {
    type: string;                   // Type of the smell (e.g., "performance", "convention")
    symbol: string;                 // Symbolic identifier for the smell (e.g., "cached-repeated-calls")
    message: string;                // Detailed description of the smell
    messageId: string;              // Unique ID for the smell
    line?: number;                  // Optional: Line number where the smell is detected
    column?: number;                // Optional: Column offset where the smell starts
    endLine?: number;               // Optional: Ending line for multiline smells
    endColumn?: number;             // Optional: Ending column for multiline smells
    confidence: string;             // Confidence level (e.g., "HIGH", "MEDIUM")
    path?: string;                  // Optional: Relative file path
    absolutePath?: string;          // Optional: Absolute file pat.
    module?: string;                // Optional: Module name
    obj?: string;                   // Optional: Object name associated with the smell (if applicable)
    repetitions?: number;           // Optional: Number of repeated occurrences
    occurrences?: Occurrence[];     // Optional: List of occurrences for repeated calls
}
