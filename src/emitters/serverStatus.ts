import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { ecoOutput } from '../extension';

/**
 * Represents possible server connection states
 */
export enum ServerStatusType {
  UNKNOWN = 'unknown', // Initial state before first connection attempt
  UP = 'up', // Server is available and responsive
  DOWN = 'down', // Server is unreachable or unresponsive
}

/**
 * Tracks and manages backend server connection state with:
 * - Status change detection
 * - Appropriate user notifications
 * - Event emission for dependent components
 */
class ServerStatus extends EventEmitter {
  private status: ServerStatusType = ServerStatusType.UNKNOWN;

  /**
   * Gets current server connection state
   * @returns Current ServerStatusType
   */
  getStatus(): ServerStatusType {
    return this.status;
  }

  /**
   * Updates server status with change detection and notifications
   * @param newStatus - Either UP or DOWN status
   */
  setStatus(newStatus: ServerStatusType.UP | ServerStatusType.DOWN): void {
    if (this.status !== newStatus) {
      const previousStatus = this.status;
      this.status = newStatus;

      // Log status transition
      ecoOutput.appendLine(
        `[serverStatus.ts] Server status changed from ${previousStatus} to ${newStatus}`,
      );

      // Handle status-specific notifications
      if (newStatus === ServerStatusType.UP) {
        if (previousStatus !== ServerStatusType.UNKNOWN) {
          ecoOutput.appendLine('[serverStatus.ts] Server connection re-established');
          vscode.window.showInformationMessage(
            'Backend server reconnected - full functionality restored',
            { modal: false },
          );
        }
      } else {
        ecoOutput.appendLine('[serverStatus.ts] Server connection lost');
        vscode.window.showWarningMessage(
          'Backend server unavailable - limited functionality',
          { modal: false },
        );
      }

      // Notify subscribers
      this.emit('change', newStatus);
    }
  }
}

/**
 * Singleton instance providing global server status management
 */
export const serverStatus = new ServerStatus();
