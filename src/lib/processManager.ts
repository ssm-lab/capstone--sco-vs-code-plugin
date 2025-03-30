import * as childProcess from 'child_process';
import { existsSync } from 'fs';
import * as net from 'net';
import { join } from 'path';
import * as vscode from 'vscode';
import { ecoOutput } from '../extension';

export class ServerProcess {
  private process?: childProcess.ChildProcess;

  constructor(private context: vscode.ExtensionContext) {}

  async start(): Promise<number> {
    const pythonPath = join(
      this.context.extensionPath,
      process.platform === 'win32'
        ? '.venv\\Scripts\\python.exe'
        : '.venv/bin/python',
    );

    if (!existsSync(pythonPath)) {
      throw new Error('Python environment not found');
    }

    await this.killProcessTree(); // Cleanup any existing process

    const port = await this.findFreePort();
    this.process = childProcess.spawn(
      pythonPath,
      ['-m', 'ecooptimizer.api', '--port', port.toString(), '--dev'],
      {
        cwd: this.context.extensionPath,
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
      },
    );

    this.process.stdout?.on('data', (data) => ecoOutput.info(`[Server] ${data}`));
    this.process.stderr?.on('data', (data) => ecoOutput.error(`[Server] ${data}`));
    this.process.on('close', () => {
      ecoOutput.info('Server off.');
      console.log('Server off.');
    });

    await this.verifyReady(port);
    return port;
  }

  private async findFreePort(): Promise<number> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.listen(0, () => {
        const port = (server.address() as net.AddressInfo).port;
        server.close(() => resolve(port));
      });
    });
  }

  private async killProcessTree(): Promise<void> {
    if (!this.process?.pid) return;

    try {
      if (process.platform === 'win32') {
        childProcess.execSync(`taskkill /PID ${this.process.pid} /T /F`);
      } else {
        process.kill(-this.process.pid, 'SIGKILL'); // Negative PID kills group
      }
    } catch (error) {
      ecoOutput.error(`Cleanup failed: ${error}`);
    } finally {
      this.process = undefined;
    }
  }

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
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    throw new Error(`Server didn't start within ${timeout}ms`);
  }

  dispose(): void {
    this.process?.kill();
  }
}
