import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface TreeNodeOptions {
  contextValue: string;
  icon?: vscode.ThemeIcon;
  tooltip?: string;
  command?: vscode.Command;
}

export interface TreeNode {
  label: string;
  fullPath: string;
  isFile: boolean;
  options?: TreeNodeOptions;
}

/**
 * Recursively builds a tree structure of Python files and valid folders.
 */
export function buildPythonTree(rootPath: string): TreeNode[] {
  const nodes: TreeNode[] = [];

  try {
    const entries = fs.readdirSync(rootPath);
    for (const entry of entries) {
      const fullPath = path.join(rootPath, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && containsPythonFiles(fullPath)) {
        nodes.push({
          label: entry,
          fullPath,
          isFile: false,
        });
      } else if (stat.isFile() && entry.endsWith('.py')) {
        nodes.push({
          label: entry,
          fullPath,
          isFile: true,
        });
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${rootPath}:`, err);
  }

  return nodes;
}

/**
 * Checks if a folder (or its subfolders) contains any .py files.
 */
function containsPythonFiles(folderPath: string): boolean {
  try {
    const entries = fs.readdirSync(folderPath);
    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isFile() && entry.endsWith('.py')) {
        return true;
      } else if (stat.isDirectory()) {
        if (containsPythonFiles(fullPath)) {
          return true;
        }
      }
    }
  } catch (err) {
    console.error(`Error checking folder ${folderPath}:`, err);
  }

  return false;
}
