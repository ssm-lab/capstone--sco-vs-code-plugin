import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Returns the EcoOptimizer log directory inside the user's home directory.
 */
function getLogDirectory(): string {
  const userHome = process.env.HOME || process.env.USERPROFILE;
  if (!userHome) {
    vscode.window.showErrorMessage('Eco: Unable to determine user home directory.');
    return '';
  }
  return path.join(userHome, '.ecooptimizer', 'outputs', 'logs');
}

const LOG_DIR = getLogDirectory();

/**
 * Defines log file paths dynamically based on the home directory.
 */
const LOG_FILES = {
  main: path.join(LOG_DIR, 'main.log'),
  detect: path.join(LOG_DIR, 'detect_smells.log'),
  refactor: path.join(LOG_DIR, 'refactor_smell.log')
};

// ✅ Create an output channel for logs
const outputChannels = {
  main: {
    channel: vscode.window.createOutputChannel('EcoOptimizer Main'),
    filePath: LOG_FILES.main
  },
  detect: {
    channel: vscode.window.createOutputChannel('EcoOptimizer Detect'),
    filePath: LOG_FILES.detect
  },
  refactor: {
    channel: vscode.window.createOutputChannel('EcoOptimizer Refactor'),
    filePath: LOG_FILES.refactor
  }
};

export function startLogging() {
  Object.entries(outputChannels).forEach(([key, value]) => {
    value.channel.clear();
    value.channel.show();

    if (!fs.existsSync(value.filePath)) {
      value.channel.appendLine('⚠️ Log file does not exist.');
      return;
    }

    fs.readFile(value.filePath, 'utf8', (err, data) => {
      if (!err) {
        value.channel.append(data);
      }
    });

    // ✅ Watch the log file for live updates
    fs.watchFile(value.filePath, { interval: 1000 }, () => {
      fs.readFile(value.filePath, 'utf8', (err, data) => {
        if (!err) {
          value.channel.clear();
          value.channel.appendLine(`📄 Viewing: ${key}`);
          value.channel.append(data);
        }
      });
    });
  });
}

/**
 * Stops watching log files when the extension is deactivated.
 */
export function stopWatchingLogs() {
  Object.values(LOG_FILES).forEach((filePath) => fs.unwatchFile(filePath));
}
