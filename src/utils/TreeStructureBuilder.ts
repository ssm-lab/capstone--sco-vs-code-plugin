import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { normalizePath } from './normalizePath';

/**
 * Options for configuring tree node appearance and behavior in the VS Code UI
 */
export interface TreeNodeOptions {
  /** Determines context menu commands and visibility rules */
  contextValue: string;
  /** Optional icon from VS Code's icon set */
  icon?: vscode.ThemeIcon;
  /** Tooltip text shown on hover */
  tooltip?: string;
  /** Command to execute when node is clicked */
  command?: vscode.Command;
}

/**
 * Represents a node in the file system tree structure
 */
export interface TreeNode {
  /** Display name in the tree view */
  label: string;
  /** Absolute filesystem path */
  fullPath: string;
  /** Whether this represents a file (true) or directory (false) */
  isFile: boolean;
  /** Additional UI/behavior configuration */
  options?: TreeNodeOptions;
}

/**
 * Builds a hierarchical tree structure of Python files and directories containing Python files
 * @param rootPath - The absolute path to start building the tree from
 * @returns Array of TreeNode objects representing the directory structure
 */
export function buildPythonTree(rootPath: string): TreeNode[] {
  const nodes: TreeNode[] = [];

  try {
    const entries = fs.readdirSync(rootPath);

    for (const entry of entries) {
      const fullPath = normalizePath(path.join(rootPath, entry));
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Only include directories that contain Python files
        if (containsPythonFiles(fullPath)) {
          nodes.push({
            label: entry,
            fullPath,
            isFile: false,
            options: {
              contextValue: 'folder',
              icon: vscode.ThemeIcon.Folder,
            },
          });
        }
      } else if (stat.isFile() && entry.endsWith('.py')) {
        nodes.push({
          label: entry,
          fullPath,
          isFile: true,
          options: {
            contextValue: 'file',
            icon: vscode.ThemeIcon.File,
          },
        });
      }
    }
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to read directory: ${rootPath}`);
    console.error(`Directory read error: ${err}`);
  }

  return nodes.sort((a, b) => {
    // Directories first, then alphabetical
    if (!a.isFile && b.isFile) return -1;
    if (a.isFile && !b.isFile) return 1;
    return a.label.localeCompare(b.label);
  });
}

/**
 * Recursively checks if a directory contains any Python files
 * @param folderPath - Absolute path to the directory to check
 * @returns True if any .py files exist in this directory or subdirectories
 */
function containsPythonFiles(folderPath: string): boolean {
  try {
    const entries = fs.readdirSync(folderPath);

    for (const entry of entries) {
      const fullPath = normalizePath(path.join(folderPath, entry));
      const stat = fs.statSync(fullPath);

      if (stat.isFile() && entry.endsWith('.py')) {
        return true;
      }

      if (stat.isDirectory()) {
        // Short-circuit if any subdirectory contains Python files
        if (containsPythonFiles(fullPath)) {
          return true;
        }
      }
    }
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to scan directory: ${folderPath}`);
    console.error(`Directory scan error: ${err}`);
  }

  return false;
}
