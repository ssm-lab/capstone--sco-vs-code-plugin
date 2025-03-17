import * as vscode from 'vscode';
import { EventEmitter } from 'events';

export enum ServerStatusType {
  UNKNOWN = 'unknown',
  UP = 'up',
  DOWN = 'down',
}

class ServerStatus extends EventEmitter {
  private status: ServerStatusType = ServerStatusType.UNKNOWN;

  getStatus(): ServerStatusType {
    return this.status;
  }

  setStatus(newStatus: ServerStatusType.UP | ServerStatusType.DOWN): void {
    if (this.status !== newStatus) {
      if (newStatus === ServerStatusType.UP) {
        if (this.status !== ServerStatusType.UNKNOWN) {
          vscode.window.showInformationMessage(
            'Server connection re-established. Smell detection and refactoring functionality resumed.',
          );
        }
      } else {
        vscode.window.showWarningMessage("Can't connect to ecooptimizer server.");
      }
      this.status = newStatus;
      this.emit('change', newStatus); // Notify listeners
    }
  }
}

// Singleton instance
export const serverStatus = new ServerStatus();
