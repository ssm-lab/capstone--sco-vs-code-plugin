import { envConfig } from './utils/envConfig'; // ENV variables should always be first import!!

import * as vscode from 'vscode';

import { detectSmells } from './commands/detectSmells';
import { refactorSelectedSmell } from './commands/refactorSmell';
import { LineSelectionManager } from './ui/lineSelectionManager';
import { ContextManager } from './context/contextManager';
import { wipeWorkCache } from './commands/wipeWorkCache';
import { updateHash } from './utils/hashDocs';
import { RefactorSidebarProvider } from './ui/refactorView';
import { handleEditorChanges } from './utils/handleEditorChange';

export function activate(context: vscode.ExtensionContext) {
  console.log('Refactor Plugin activated');

  // Show the settings popup if needed
  showSettingsPopup();

  // Register a listener for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      handleConfigurationChange(event);
    })
  );
  const contextManager = new ContextManager(context);

  // ===============================================================
  // INITIALIZE WORKSPACE DATA
  // ===============================================================

  let smellsData = contextManager.getWorkspaceData(envConfig.SMELL_MAP_KEY!);
  if (!smellsData) {
    smellsData = {};
    contextManager.setWorkspaceData(envConfig.SMELL_MAP_KEY!, smellsData);
  }

  let fileHashes = contextManager.getWorkspaceData(envConfig.FILE_CHANGES_KEY!);
  if (!fileHashes) {
    fileHashes = {};
    contextManager.setWorkspaceData(envConfig.FILE_CHANGES_KEY!, fileHashes);
  }

  // console.log(
  //   `Smell detection map: ${contextManager.getWorkspaceData(
  //     envConfig.SMELL_MAP_KEY!
  //   )}`
  // );

  // ===============================================================
  // REGISTER COMMANDS
  // ===============================================================

  // Register Detect Smells Command
  let detectSmellsCmd = vscode.commands.registerCommand(
    'ecooptimizer-vs-code-plugin.detectSmells',
    async () => {
      console.log('Command detectSmells triggered');
      detectSmells(contextManager);
    }
  );
  context.subscriptions.push(detectSmellsCmd);

  // Register Refactor Smell Command
  let refactorSmellCmd = vscode.commands.registerCommand(
    'ecooptimizer-vs-code-plugin.refactorSmell',
    () => {
      console.log('Command refactorSmells triggered');
      vscode.window.showInformationMessage('Eco: Detecting smells...');
      refactorSelectedSmell(contextManager);
    }
  );
  context.subscriptions.push(refactorSmellCmd);

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
  );
  context.subscriptions.push(wipeWorkCacheCmd);

  // ===============================================================
  // REGISTER VIEWS
  // ===============================================================

  // Register the webview provider for the refactoring webview
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
      console.log(`Detected line selection event`);

      lineSelectManager.commentLine(event.textEditor);
    })
  );

  // Updates directory of file states (for checking if modified)
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      await updateHash(contextManager, document);
    })
  );

  // Handles case of documents already being open on vscode open
  vscode.window.visibleTextEditors.forEach(async (editor) => {
    if (editor.document) {
      await updateHash(contextManager, editor.document);
    }
  });

  // Initializes first state of document when opened while extension active
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(
      async (document) => await updateHash(contextManager, document)
    )
  );
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
          vscode.commands.executeCommand('workbench.action.openSettings', 'ecooptimizer-vs-code-plugin');
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
    event.affectsConfiguration('ecooptimizer-vs-code-plugin.unitTestPath') ||
    event.affectsConfiguration('ecooptimizer-vs-code-plugin.logsOutputPath')
  ) {
    // Display a warning message about changing critical settings
    vscode.window.showWarningMessage(
      'You have changed a critical setting for the EcoOptimizer plugin. Ensure the new value is valid and correct for optimal functionality.'
    );
  }
}


export function deactivate() {
  console.log('Refactor Plugin deactivated');
}
