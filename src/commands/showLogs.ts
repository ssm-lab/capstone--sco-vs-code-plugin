import * as vscode from 'vscode';
import WebSocket from 'ws';

import { initLogs } from '../api/backend';
import { envConfig } from '../utils/envConfig';
import { serverStatus, ServerStatusType } from '../emitters/serverStatus';

const WEBSOCKET_BASE_URL = `ws://${envConfig.SERVER_URL}/logs`;

class LogInitializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LogInitializationError';
  }
}

export class LogManager {
  private websockets: { [key: string]: WebSocket | undefined };
  private channels: {
    [key: string]: { name: string; channel: vscode.LogOutputChannel | undefined };
  };
  private channelsCreated: boolean;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.websockets = {
      main: undefined,
      detect: undefined,
      refactor: undefined,
    };
    this.channels = {
      main: { name: 'EcoOptimizer: Main', channel: undefined },
      detect: { name: 'EcoOptimizer: Detect', channel: undefined },
      refactor: { name: 'EcoOptimizer: Refactor', channel: undefined },
    };
    this.channelsCreated = false;

    // Listen for server status changes
    serverStatus.on('change', async (newStatus: ServerStatusType) => {
      console.log('Server status changed:', newStatus);
      if (newStatus === ServerStatusType.DOWN) {
        this.channels.main.channel?.appendLine('Server connection lost');
      } else {
        this.channels.main.channel?.appendLine('Server connection re-established.');
        await this.startLogging();
      }
    });
  }

  /**
   * Starts the logging process, including initializing logs and WebSockets.
   * @param retries - Number of retry attempts.
   * @param delay - Initial delay between retries (in milliseconds).
   */
  public async startLogging(retries = 3, delay = 1000): Promise<void> {
    let logInitialized = false;
    const logPath = this.context.logUri?.fsPath;

    if (!logPath) {
      throw new LogInitializationError(
        'Missing extension context or logUri. Cannot initialize logging.',
      );
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (!logInitialized) {
          logInitialized = await initLogs(logPath);

          if (!logInitialized) {
            throw new LogInitializationError(
              `Failed to initialize logs at path: ${logPath}`,
            );
          }
          console.log('Log initialization successful.');
        }

        this.initializeWebSockets();
        console.log('Successfully initialized WebSockets. Logging is now active.');
        return;
      } catch (error) {
        const err = error as Error;
        console.error(`[Attempt ${attempt}/${retries}] ${err.name}: ${err.message}`);

        if (attempt < retries) {
          console.log(`Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        } else {
          throw new Error('Max retries reached. Logging process failed.');
        }
      }
    }
  }

  /**
   * Initializes WebSocket connections for logging.
   */
  private initializeWebSockets(): void {
    if (!this.channelsCreated) {
      this.createOutputChannels();
      this.channelsCreated = true;
    }
    this.startWebSocket('main');
    this.startWebSocket('detect');
    this.startWebSocket('refactor');
  }

  /**
   * Creates output channels for logging.
   */
  private createOutputChannels(): void {
    console.log('Creating output channels');
    for (const channel of Object.keys(this.channels)) {
      this.channels[channel].channel = vscode.window.createOutputChannel(
        this.channels[channel].name,
        { log: true },
      );
    }
  }

  /**
   * Starts a WebSocket connection for a specific log type.
   * @param logType - The type of log (e.g., 'main', 'detect', 'refactor').
   */
  private startWebSocket(logType: string): void {
    const url = `${WEBSOCKET_BASE_URL}/${logType}`;
    const ws = new WebSocket(url);
    this.websockets[logType] = ws;

    ws.on('message', (data) => {
      const logEvent = data.toString('utf8');
      const level =
        logEvent.match(/\b(ERROR|DEBUG|INFO|WARNING|TRACE)\b/i)?.[0].trim() ||
        'UNKNOWN';
      const msg = logEvent.split(`[${level}]`, 2)[1].trim();

      switch (level) {
        case 'ERROR': {
          this.channels[logType].channel!.error(msg);
          break;
        }
        case 'DEBUG': {
          this.channels[logType].channel!.debug(msg);
          break;
        }
        case 'WARNING': {
          this.channels[logType].channel!.warn(msg);
          break;
        }
        case 'CRITICAL': {
          this.channels[logType].channel!.error(msg);
          break;
        }
        default: {
          this.channels[logType].channel!.info(msg);
          break;
        }
      }
    });

    ws.on('error', (err) => {
      this.channels[logType].channel!.error(`WebSocket error: ${err.message}`);
    });

    ws.on('close', () => {
      this.channels[logType].channel!.appendLine(
        `WebSocket connection closed for ${this.channels[logType].name}`,
      );
    });

    ws.on('open', () => {
      this.channels[logType].channel!.appendLine(
        `Connected to ${logType} via WebSocket`,
      );
    });
  }

  /**
   * Stops watching logs and cleans up resources.
   */
  public stopWatchingLogs(): void {
    Object.values(this.websockets).forEach((ws) => ws?.close());
    Object.values(this.channels).forEach((channel) => channel.channel?.dispose());
  }
}
