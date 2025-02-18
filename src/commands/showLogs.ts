import * as vscode from 'vscode';
import WebSocket from 'ws';

import { initLogs } from '../api/backend';
import { envConfig } from '../utils/envConfig';

const WEBSOCKET_BASE_URL = `ws://${envConfig.SERVER_URL}/logs`;

let websockets: WebSocket[] = [];

let mainLogChannel: vscode.OutputChannel | undefined;
let detectSmellsChannel: vscode.OutputChannel | undefined;
let refactorSmellChannel: vscode.OutputChannel | undefined;

export async function startLogging(context: vscode.ExtensionContext) {
  const initialized = await initializeBackendSync(context);

  if (initialized) {
    startWebSocket('main', 'EcoOptimizer: Main Logs');
    startWebSocket('detect', 'EcoOptimizer: Detect Smells');
    startWebSocket('refactor', 'EcoOptimizer: Refactor Smell');

    console.log('Successfully initialized logging.');
  }
}

async function initializeBackendSync(context: vscode.ExtensionContext) {
  const logPath = context.logUri.fsPath;

  console.log('Log path:', logPath);

  return await initLogs(logPath);
}

function startWebSocket(logType: string, channelName: string) {
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

  ws.onerror = (event) => {
    channel.appendLine(`WebSocket error: ${event}`);
  };

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
export function stopWatchingLogs() {
  websockets.forEach((ws) => ws.close());

  mainLogChannel?.dispose();
  detectSmellsChannel?.dispose();
  refactorSmellChannel?.dispose();
}
