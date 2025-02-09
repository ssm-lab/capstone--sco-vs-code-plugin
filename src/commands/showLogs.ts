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

/**
 * Defines log file paths dynamically based on the home directory.
 */
function getLogFiles(): Record<string, string> {
  const LOG_DIR = getLogDirectory();
  return {
    'Main Log': path.join(LOG_DIR, 'main.log'),
    'Detect Smells Log': path.join(LOG_DIR, 'detect_smells.log'),
    'Refactor Smell Log': path.join(LOG_DIR, 'refactor_smell.log')
  };
}

// ✅ Create an output channel for logs
let outputChannel = vscode.window.createOutputChannel('Eco Optimizer Logs');

/**
 * Registers the command to show logs in VS Code.
 */
export function showLogsCommand(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ecooptimizer-vs-code-plugin.showLogs',
      async () => {
        const LOG_FILES = getLogFiles();
        if (!LOG_FILES['Main Log']) {
          vscode.window.showErrorMessage('Eco: Log directory is not set.');
          return;
        }

        const selectedLog: string | undefined = await vscode.window.showQuickPick(
          Object.keys(LOG_FILES),
          {
            placeHolder: 'Select a log file to view'
          }
        );

        if (selectedLog) {
          showLogFile(LOG_FILES[selectedLog], selectedLog);
        }
      }
    )
  );
}

/**
 * Displays the log file content in VS Code's Output Panel.
 */
function showLogFile(filePath: string, logName: string) {
  outputChannel.clear();
  outputChannel.show();
  outputChannel.appendLine(`📄 Viewing: ${logName}`);

  if (!fs.existsSync(filePath)) {
    outputChannel.appendLine('⚠️ Log file does not exist.');
    return;
  }

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (!err) {
      outputChannel.append(data);
    }
  });

  // ✅ Watch the log file for live updates
  fs.watchFile(filePath, { interval: 1000 }, () => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (!err) {
        outputChannel.clear();
        outputChannel.appendLine(`📄 Viewing: ${logName}`);
        outputChannel.append(data);
      }
    });
  });
}

/**
 * Stops watching log files when the extension is deactivated.
 */
export function stopWatchingLogs() {
  Object.values(getLogFiles()).forEach((filePath) => fs.unwatchFile(filePath));
}
