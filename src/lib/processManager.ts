import * as childProcess from 'child_process';
import { existsSync } from 'fs';
import * as net from 'net';
import { join } from 'path';
import * as vscode from 'vscode';
import { ecoOutput } from '../extension';

/**
 * Manages the lifecycle of the backend server process, including:
 * - Starting the Python server with proper environment
 * - Port allocation and verification
 * - Process cleanup on exit
 * - Logging and error handling
 */
export class ServerProcess {
  private process?: childProcess.ChildProcess;

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Starts the backend server process and verifies it's ready.
   * @returns Promise resolving to the port number the server is running on
   * @throws Error if server fails to start or Python environment is missing
   */
  async start(): Promise<number> {
    // Determine Python executable path based on platform
    const pythonPath = join(
      this.context.extensionPath,
      process.platform === 'win32'
        ? '.venv\\Scripts\\python.exe'
        : '.venv/bin/python',
    );

    if (!existsSync(pythonPath)) {
      throw new Error('Python environment not found');
    }

    // Clean up any existing server process
    await this.killProcessTree();

    // Find and bind to an available port
    const port = await this.findFreePort();

    // Start the Python server process
    this.process = childProcess.spawn(
      pythonPath,
      ['-m', 'ecooptimizer.api', '--port', port.toString(), '--dev'],
      {
        cwd: this.context.extensionPath,
        env: { ...process.env, PYTHONUNBUFFERED: '1' }, // Ensure unbuffered output
      },
    );

    // Set up process event handlers
    this.process.stdout?.on('data', (data) => ecoOutput.info(`[Server] ${data}`));
    this.process.stderr?.on('data', (data) => ecoOutput.error(`[Server] ${data}`));
    this.process.on('close', () => {
      ecoOutput.info('Server stopped');
      console.log('Server stopped');
    });

    // Verify server is actually listening before returning
    await this.verifyReady(port);
    return port;
  }

  /**
   * Finds an available network port
   * @returns Promise resolving to an available port number
   */
  private async findFreePort(): Promise<number> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.listen(0, () => {
        const port = (server.address() as net.AddressInfo).port;
        server.close(() => resolve(port));
      });
    });
  }

  /**
   * Kills the server process and its entire process tree
   * Handles platform-specific process termination
   */
  private async killProcessTree(): Promise<void> {
    if (!this.process?.pid) return;

    try {
      if (process.platform === 'win32') {
        // Windows requires taskkill for process tree termination
        childProcess.execSync(`taskkill /PID ${this.process.pid} /T /F`);
      } else {
        // Unix systems can kill process groups with negative PID
        process.kill(-this.process.pid, 'SIGKILL');
      }
    } catch (error) {
      ecoOutput.error(`Process cleanup failed: ${error}`);
    } finally {
      this.process = undefined;
    }
  }

  /**
   * Verifies the server is actually listening on the specified port
   * @param port Port number to check
   * @param timeout Maximum wait time in milliseconds
   * @throws Error if server doesn't become ready within timeout
   */
  private async verifyReady(port: number, timeout = 10000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const socket = net.createConnection({ port });
        await new Promise((resolve, reject) => {
          socket.on('connect', resolve);
          socket.on('error', reject);
        });
        socket.end();
        return;
      } catch {
        // Retry after short delay if connection fails
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    throw new Error(`Server didn't start within ${timeout}ms`);
  }

  /**
   * Clean up resources when disposing of the manager
   */
  dispose(): void {
    this.process?.kill();
  }
}
