import * as vscode from 'vscode';
import { EventEmitter } from 'events';

class ServerStatus extends EventEmitter {
  private status: 'unknown' | 'up' | 'down' = 'unknown';

  getStatus() {
    return this.status;
  }

  setStatus(newStatus: 'up' | 'down') {
    if (this.status !== newStatus) {
      if (newStatus === 'up') {
        if (this.status !== 'unknown') {
          vscode.window.showInformationMessage(
            'Server connection re-established. Smell detection and refactoring functionality resumed.'
          );
        }
      } else {
        vscode.window.showWarningMessage('Server connection lost.');
      }
      this.status = newStatus;
      this.emit('change', newStatus); // Notify listeners
    }
  }
}

// Singleton instance
export const serverStatus = new ServerStatus();
