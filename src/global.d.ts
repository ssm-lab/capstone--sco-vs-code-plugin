export {};

// global.d.ts
export {};

declare global {
    // Define your global types here
    interface Smell {
        absolutePath: string;
        column: number;
        confidence: string; // e.g., "UNDEFINED", "INFERENCE"
        endColumn: number | null;
        endLine: number | null;
        line: number;
        message: string;
        messageId: string; // e.g., "R0902", "LMC001"
        module: string;
        obj: string;
        path: string;
        symbol: string; // e.g., "too-many-instance-attributes"
        type: string; // e.g., "refactor", "warning", "convention"
    }
    

    interface RefactorOutput {
        refactored_code: string; // Refactored code as a string
        energy_difference?: number; // Optional: energy difference (if provided)
        updated_smells?: any[]; // Optional: updated smells (if provided)
    }
}
