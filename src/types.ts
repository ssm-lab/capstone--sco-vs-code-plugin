// Enum for confidence
export enum Confidence {
    UNDEFINED = "UNDEFINED",
    INFERENCE = "INFERENCE",
}

// Interface to represent the structure of a smell object
export interface Smell {
    type: string;
    symbol: string;
    message: string;
    messageId: string;
    confidence: Confidence;
    module: string;
    obj: string;
    line: number;
    column: number;
    endLine: number | null;
    endColumn: number | null;
    path: string;
    absolutePath: string;
}

// Interface for the root structure
export interface Data {
    smells: Smell[];
}
