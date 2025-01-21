export {};

// global.d.ts
export {};

declare global {
    // Define your global types here
    interface Smell {
        line: number; // Known attribute
        [key: string]: any; // Index signature for unknown properties
    }

    interface RefactorOutput {
        refactored_code: string; // Refactored code as a string
        energy_difference?: number; // Optional: energy difference (if provided)
        updated_smells?: any[]; // Optional: updated smells (if provided)
    }
}
