export {};

// global.d.ts
export {};

declare global {
    // Define your global types here
    interface Occurrence {
        line: number;
        column: number;
        call_string: string;
    }
    
    interface Smell {
        type: string;                   // Type of the smell (e.g., "performance", "convention")
        symbol: string;                 // Symbolic identifier for the smell (e.g., "cached-repeated-calls")
        message: string;                // Detailed description of the smell
        messageId: string;              // Unique ID for the smell
        line?: number;                   // Line number where the smell is detected
        column?: number;                 // Column offset where the smell starts
        endLine?: number;               // Optional: Ending line for multiline smells
        endColumn?: number;             // Optional: Ending column for multiline smells
        confidence: string;             // Confidence level (e.g., "HIGH", "MEDIUM")
        path?: string;                   // Relative file path
        absolutePath?: string;           // Absolute file pat.
        module?: string;                 // Module name
        obj?: string;                    // Object name associated with the smell (if applicable)
        repetitions?: number;           // Optional: Number of repeated occurrences
        occurrences?: Occurrence[];     // Optional: List of occurrences for repeated calls
    }
    
    

    interface RefactorOutput {
        refactored_code: string; // Refactored code as a string
        energy_difference?: number; // Optional: energy difference (if provided)
        updated_smells?: any[]; // Optional: updated smells (if provided)
    }
}
