// import * as vscode from 'vscode';
// import { ContextManager } from '../context/contextManager';
// import { FileHighlighter } from '../ui/fileHighlighter'; // Import the class
// import { envConfig } from '../utils/envConfig';

// export async function toggleSmellLinting(
//   contextManager: ContextManager,
// ): Promise<void> {
//   const isEnabled = contextManager.getWorkspaceData(
//     envConfig.SMELL_LINTING_ENABLED_KEY,
//     false,
//   );
//   const newState = !isEnabled;

//   // Update state immediately for UI responsiveness
//   vscode.commands.executeCommand('setContext', 'eco.smellLintingEnabled', newState);

//   // Use the singleton instance of FileHighlighter
//   const fileHighlighter = FileHighlighter.getInstance(contextManager);

//   try {
//     if (newState) {
//       // Run detection and update state on success
//       await detectSmells(contextManager); // in the future recieve a true/false

//       await contextManager.setWorkspaceData(
//         envConfig.SMELL_LINTING_ENABLED_KEY,
//         newState,
//       );
//     } else {
//       // Clear highlights and update state
//       fileHighlighter.resetHighlights(); // Call resetHighlights on the singleton instance
//       await contextManager.setWorkspaceData(
//         envConfig.SMELL_LINTING_ENABLED_KEY,
//         newState,
//       );
//       vscode.window.showInformationMessage('Eco: Smell linting turned off.');
//     }
//   } catch (error) {
//     console.error('Eco: Error toggling smell linting:', error);
//     vscode.window.showErrorMessage('Eco: Failed to toggle smell linting.');
//     // Ensure UI state matches actual on error
//     vscode.commands.executeCommand(
//       'setContext',
//       'eco.smellLintingEnabled',
//       isEnabled,
//     );
//   }
// }
