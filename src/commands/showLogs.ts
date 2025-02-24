import * as vscode from 'vscode';
import WebSocket from 'ws';

import { initLogs } from '../api/backend';
import { envConfig } from '../utils/envConfig';
import { serverStatus, ServerStatusType } from '../utils/serverStatus';
import { globalData } from '../extension';

class LogInitializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LogInitializationError';
  }
}

class WebSocketInitializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebSocketInitializationError';
  }
}

const WEBSOCKET_BASE_URL = `ws://${envConfig.SERVER_URL}/logs`;

let websockets: WebSocket[] = [];

let mainLogChannel: vscode.OutputChannel | undefined;
let detectSmellsChannel: vscode.OutputChannel | undefined;
let refactorSmellChannel: vscode.OutputChannel | undefined;

let CHANNELS_CREATED = false;

serverStatus.on('change', async (newStatus: ServerStatusType) => {
  console.log('Server status changed:', newStatus);
  if (newStatus === ServerStatusType.DOWN) {
    mainLogChannel?.appendLine('Server connection lost');
  } else {
    mainLogChannel?.appendLine('Server connection re-established.');
    await startLogging();
  }
});

export async function startLogging(retries = 3, delay = 1000): Promise<void> {
  let logInitialized = false;
  const logPath = globalData.contextManager?.context.logUri?.fsPath;

  if (!logPath) {
    console.error('Missing contextManager or logUri. Cannot initialize logging.');
    return;
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

      if (CHANNELS_CREATED) {
        console.warn(
          'Logging channels already initialized. Skipping WebSocket setup.',
        );
        return;
      }

      // Try initializing WebSockets separately
      try {
        initializeWebSockets();
        console.log('Successfully initialized WebSockets. Logging is now active.');
        return; // Exit function if everything is successful
      } catch {
        throw new WebSocketInitializationError('Failed to initialize WebSockets.');
      }
    } catch (error) {
      const err = error as Error;
      console.error(`[Attempt ${attempt}/${retries}] ${err.name}: ${err.message}`);

      if (attempt < retries) {
        console.log(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        console.error('Max retries reached. Logging process failed.');
      }
    }
  }
}

function initializeWebSockets(): void {
  startWebSocket('main', 'EcoOptimizer: Main Logs');
  startWebSocket('detect', 'EcoOptimizer: Detect Smells');
  startWebSocket('refactor', 'EcoOptimizer: Refactor Smell');

  CHANNELS_CREATED = true;
}

function startWebSocket(logType: string, channelName: string): void {
  const url = `${WEBSOCKET_BASE_URL}/${logType}`;
  const ws = new WebSocket(url);
  websockets.push(ws);

  let channel: vscode.OutputChannel;
  if (logType === 'main') {
    mainLogChannel = vscode.window.createOutputChannel(channelName);
    channel = mainLogChannel;
  } else if (logType === 'detect') {
    detectSmellsChannel = vscode.window.createOutputChannel(channelName);
    channel = detectSmellsChannel;
  } else if (logType === 'refactor') {
    refactorSmellChannel = vscode.window.createOutputChannel(channelName);
    channel = refactorSmellChannel;
  } else {
    return;
  }

  ws.on('message', function message(data) {
    channel.append(data.toString('utf8'));
  });

  ws.on('error', function error(err) {
    channel.appendLine(`WebSocket error: ${err}`);
  });

  ws.on('close', function close() {
    channel.appendLine(`WebSocket connection closed for ${logType}`);
  });

  ws.on('open', function open() {
    channel.appendLine(`Connected to ${channelName} via WebSocket`);
  });
}

/**
 * Stops watching log files when the extension is deactivated.
 */
export function stopWatchingLogs(): void {
  websockets.forEach((ws) => ws.close());

  mainLogChannel?.dispose();
  detectSmellsChannel?.dispose();
  refactorSmellChannel?.dispose();
}
