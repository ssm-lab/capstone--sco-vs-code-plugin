import { execFile } from "child_process";
import * as vscode from "vscode";

export class BackendCommunicator {
    private backendCommand: string;

    constructor() {
        this.backendCommand = "python3"; 
    }

    // run(command: string, args: string[]): Promise<string> {
    //     return new Promise((resolve, reject) => {
    //         const fullArgs = ["-m", "ecooptimizer.main", command, ...args];
    //         // Replace with your local directory
    //         const cwd = "/Users/tanveerbrar/2024-25/4g06/capstone--source-code-optimizer/src";
    //         console.log(`Executing: ${this.backendCommand} ${fullArgs.join(" ")} in ${cwd}`);

    //         execFile(this.backendCommand, fullArgs, { cwd }, (error, stdout, stderr) => {
    //             if (error) {
    //                 console.error("Error:", stderr || error.message);
    //                 reject(stderr || error.message);
    //             } else {
    //                 console.log("Output:", stdout);
    //                 resolve(stdout);
    //             }
    //         });
    //     });
    // }
    // run(command: string, args: string[], context: vscode.ExtensionContext): Promise<string> {
    //     return new Promise((resolve, reject) => {
    //         const fullArgs = ["example.py", command, ...args];
    //         const logDir = context.globalStorageUri.fsPath;
    //         const cwd = "/Users/tanveerbrar/2024-25/4g06/capstone--source-code-optimizer/src";
    //         console.log(`Executing: ${this.backendCommand} ${fullArgs.join(" ")} in ${cwd}`);
    //         console.log(`Log directory: ${logDir}`);

    //         const env = {
    //             ...process.env,
    //             LOG_DIR: logDir,
    //         };

    //         execFile(this.backendCommand, fullArgs, {cwd, env }, (error, stdout, stderr) => {
    //             if (error) {
    //                 console.error("Error:", stderr || error.message);
    //                 reject(stderr || error.message);
    //             } else {
    //                 console.log("Output:", stdout);
    //                 resolve(stdout);
    //             }
    //         });
    //     });
    // }
    run(command: string, args: string[], context: vscode.ExtensionContext): Promise<string> {
        return new Promise((resolve, reject) => {
            const cwd = "/Users/tanveerbrar/2024-25/4g06/capstone--source-code-optimizer/src/ecooptimizer/";
            const fullArgs = ["example.py", command, ...args];
            const logDir = context.globalStorageUri.fsPath;
            
            console.log(`Executing: ${this.backendCommand} ${fullArgs.join(" ")} in ${cwd}`);
            console.log(`Log directory: ${logDir}`);

            const env = {
                ...process.env,
                LOG_DIR: logDir,
            };

            execFile(this.backendCommand, fullArgs, {cwd}, (error, stdout, stderr) => {
                if (error) {
                    console.error("Error:", stderr || error.message);
                    reject(stderr || error.message);
                } else {
                    console.log("Output:", stdout);
                    resolve(stdout);
                }
            });
        });
    }
}
