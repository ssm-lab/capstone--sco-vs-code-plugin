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

let websockets: { [key: string]: WebSocket | undefined } = {
  main: undefined,
  detect: undefined,
  refactor: undefined,
};

let channels: {
  [key: string]: { name: string; channel: vscode.LogOutputChannel | undefined };
} = {
  main: {
    name: 'EcoOptimizer: Main',
    channel: undefined,
  },
  detect: {
    name: 'EcoOptimizer: Detect',
    channel: undefined,
  },
  refactor: {
    name: 'EcoOptimizer: Refactor',
    channel: undefined,
  },
};

let CHANNELS_CREATED = false;

serverStatus.on('change', async (newStatus: ServerStatusType) => {
  console.log('Server status changed:', newStatus);
  if (newStatus === ServerStatusType.DOWN) {
    channels.main.channel?.appendLine('Server connection lost');
  } else {
    channels.main.channel?.appendLine('Server connection re-established.');
    await startLogging();
  }
});

export async function startLogging(retries = 3, delay = 1000): Promise<void> {
  let logInitialized = false;
  const logPath = globalData.contextManager?.context.logUri?.fsPath;
  console.log('log path:', logPath);

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

      try {
        initializeWebSockets();
        console.log('Successfully initialized WebSockets. Logging is now active.');
        return;
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
  if (!CHANNELS_CREATED) {
    createOutputChannels();
    CHANNELS_CREATED = true;
  }
  startWebSocket('main');
  startWebSocket('detect');
  startWebSocket('refactor');
}

function createOutputChannels(): void {
  console.log('Creating ouput channels');
  for (const channel of Object.keys(channels)) {
    channels[channel].channel = vscode.window.createOutputChannel(
      channels[channel].name,
      { log: true },
    );
  }
}

function startWebSocket(logType: string): void {
  const url = `${WEBSOCKET_BASE_URL}/${logType}`;
  const ws = new WebSocket(url);
  websockets[logType] = ws;

  ws.on('message', function message(data) {
    const logEvent = data.toString('utf8');
    const level =
      logEvent.match(/\b(ERROR|DEBUG|INFO|WARNING|TRACE)\b/i)?.[0].trim() ||
      'UNKNOWN';
    const msg = logEvent.split(`[${level}]`, 2)[1].trim();

    console.log(logEvent);
    console.log('Level:', level);

    switch (level) {
      case 'ERROR': {
        channels[logType].channel!.error(msg);
        break;
      }
      case 'DEBUG': {
        console.log('logging debug');
        channels[logType].channel!.debug(msg);
        break;
      }
      case 'WARNING': {
        channels[logType].channel!.warn(msg);
        break;
      }
      case 'CRITICAL': {
        channels[logType].channel!.error(msg);
        break;
      }
      default: {
        console.log('Logging info');
        channels[logType].channel!.info(msg);
        break;
      }
    }
  });

  ws.on('error', function error(err) {
    channels[logType].channel!.error(err);
  });

  ws.on('close', function close() {
    channels[logType].channel!.appendLine(
      `WebSocket connection closed for ${channels[logType].name}`,
    );
  });

  ws.on('open', function open() {
    channels[logType].channel!.appendLine(`Connected to ${logType} via WebSocket`);
  });
}

/**
 * Stops watching log files when the extension is deactivated.
 */
export function stopWatchingLogs(): void {
  Object.values(websockets).forEach((ws) => ws?.close());

  Object.values(channels).forEach((channel) => channel.channel?.dispose());
}
