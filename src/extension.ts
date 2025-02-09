import { envConfig } from './utils/envConfig';
import * as vscode from 'vscode';

import { detectSmells } from './commands/detectSmells';
import { refactorSelectedSmell } from './commands/refactorSmell';
import { refactorAllSmellType } from './commands/refactorAllSmellsOfType';
import { wipeWorkCache } from './commands/wipeWorkCache';
import { showLogsCommand, stopWatchingLogs } from './commands/showLogs';
import { ContextManager } from './context/contextManager';
import {
  getEnabledSmells,
  handleSmellFilterUpdate
} from './utils/handleSmellSettings';
import { updateHash } from './utils/hashDocs';
import { RefactorSidebarProvider } from './ui/refactorView';
import { handleEditorChanges } from './utils/handleEditorChange';
import { LineSelectionManager } from './ui/lineSelectionManager';


export function activate(context: vscode.ExtensionContext) {
  console.log('Refactor Plugin activated');

  // Show the settings popup if needed
  console.log('Eco: Refactor Plugin Activated Successfully');
  showSettingsPopup();

  // Register a listener for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      handleConfigurationChange(event);
    })
  );
  const contextManager = new ContextManager(context);

  let smellsData = contextManager.getWorkspaceData(envConfig.SMELL_MAP_KEY!) || {};
  contextManager.setWorkspaceData(envConfig.SMELL_MAP_KEY!, smellsData);

  let fileHashes =
    contextManager.getWorkspaceData(envConfig.FILE_CHANGES_KEY!) || {};
  contextManager.setWorkspaceData(envConfig.FILE_CHANGES_KEY!, fileHashes);

  // ===============================================================
  // REGISTER COMMANDS
  // ===============================================================

  // Detect Smells Command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ecooptimizer-vs-code-plugin.detectSmells',
      async () => {
        console.log('Eco: Detect Smells Command Triggered');
        detectSmells(contextManager);
      }
    )
  );

  // Refactor Selected Smell Command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ecooptimizer-vs-code-plugin.refactorSmell',
      () => {
        console.log('Eco: Refactor Selected Smell Command Triggered');
        refactorSelectedSmell(contextManager);
      }
    )
  );

  // Register Refactor All Smells of a Given Type Command
<<<<<<< HEAD
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ecooptimizer-vs-code-plugin.refactorAllSmellsOfType',
      () => {
        console.log('Command refactorAllSmellsOfType triggered');
        vscode.window.showInformationMessage(`Eco: Refactoring all smells of the given type...`);
        refactorAllSmellType(contextManager);
      }
    )
=======
  let refactorAllSmellsOfTypeCmd = vscode.commands.registerCommand(
    'ecooptimizer-vs-code-plugin.refactorAllSmellsOfType',
    () => {
      console.log('Command refactorAllSmellsOfType triggered');
      vscode.window.showInformationMessage(`Eco: Refactoring all smells of the given type...`);
      refactorAllSmellType(contextManager);
    }
  );
  context.subscriptions.push(refactorAllSmellsOfTypeCmd); 

  // Register Wipe Workspace Cache
  let wipeWorkCacheCmd = vscode.commands.registerCommand(
    'ecooptimizer-vs-code-plugin.wipeWorkCache',
    () => {
      console.log('Command wipeWorkCache triggered');
      vscode.window.showInformationMessage(
        'Eco: Wiping existing worspace memory...'
      );
      wipeWorkCache(contextManager);
    }
>>>>>>> 746dc58 (Started working on front end of the refactor all smells of type)
  );
  
  // Wipe Cache Command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ecooptimizer-vs-code-plugin.wipeWorkCache',
      async () => {
        console.log('Eco: Wipe Work Cache Command Triggered');
        vscode.window.showInformationMessage(
          'Eco: Manually wiping workspace memory... ✅'
        );
        await wipeWorkCache(contextManager, 'manual');
      }
    )
  );

  // Log Viewing Command
  showLogsCommand(context);

  // ===============================================================
  // REGISTER VIEWS
  // ===============================================================

  const refactorProvider = new RefactorSidebarProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      RefactorSidebarProvider.viewType,
      refactorProvider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ecooptimizer-vs-code-plugin.showRefactorSidebar',
      () => refactorProvider.updateView()
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ecooptimizer-vs-code-plugin.pauseRefactorSidebar',
      () => refactorProvider.pauseView()
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ecooptimizer-vs-code-plugin.clearRefactorSidebar',
      () => refactorProvider.clearView()
    )
  );

  // ===============================================================
  // ADD LISTENERS
  // ===============================================================

  vscode.window.onDidChangeVisibleTextEditors(async (editors) => {
    handleEditorChanges(contextManager, editors);
  });

  // Adds comments to lines describing the smell
  const lineSelectManager = new LineSelectionManager(contextManager);
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((event) => {
      console.log('Eco: Detected line selection event');
      lineSelectManager.commentLine(event.textEditor);
    })
  );

  // Updates directory of file states (for checking if modified)
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      await updateHash(contextManager, document);
    })
  );

  // Handles case of documents already being open on VS Code open
  vscode.window.visibleTextEditors.forEach(async (editor) => {
    if (editor.document) {
      await updateHash(contextManager, editor.document);
    }
  });

  // Initializes first state of document when opened while extension is active
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(
      async (document) => await updateHash(contextManager, document)
    )
  );

  // ===============================================================
  // HANDLE SMELL FILTER CHANGES
  // ===============================================================

  let previousSmells = getEnabledSmells();
  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('ecooptimizer.enableSmells')) {
      console.log('Eco: Smell preferences changed! Wiping cache.');
      handleSmellFilterUpdate(previousSmells, contextManager);
      previousSmells = getEnabledSmells();
    }
  });
}

function showSettingsPopup() {
  // Check if the required settings are already configured
  const config = vscode.workspace.getConfiguration('ecooptimizer-vs-code-plugin');
  const workspacePath = config.get<string>('projectWorkspacePath', '');
  const logsOutputPath = config.get<string>('logsOutputPath', '');
  const unitTestPath = config.get<string>('unitTestPath', '');

  // If settings are not configured, prompt the user to configure them
  if (!workspacePath || !logsOutputPath || !unitTestPath) {
    vscode.window
      .showInformationMessage(
        'Please configure the paths for your workspace and logs.',
        { modal: true },
        'Continue', // Button to open settings
        'Skip for now' // Button to dismiss
      )
      .then((selection) => {
        if (selection === 'Continue') {
          // Open the settings page filtered to extension's settings
          vscode.commands.executeCommand(
            'workbench.action.openSettings',
            'ecooptimizer-vs-code-plugin'
          );
        } else if (selection === 'Skip for now') {
          // Inform user they can configure later
          vscode.window.showInformationMessage(
            'You can configure the paths later in the settings.'
          );
        }
      });
  }
}

function handleConfigurationChange(event: vscode.ConfigurationChangeEvent) {
  // Check if any relevant setting was changed
  if (
    event.affectsConfiguration('ecooptimizer-vs-code-plugin.projectWorkspacePath') ||
    event.affectsConfiguration('ecooptimizer-vs-code-plugin.unitTestCommand') ||
    event.affectsConfiguration('ecooptimizer-vs-code-plugin.logsOutputPath')
  ) {
    // Display a warning message about changing critical settings
    vscode.window.showWarningMessage(
      'You have changed a critical setting for the EcoOptimizer plugin. Ensure the new value is valid and correct for optimal functionality.'
    );
  }
}

export function deactivate() {
  console.log('Eco: Deactivating Plugin - Stopping Log Watching');
  stopWatchingLogs();
}
