import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Defines the structure of the smell configuration in smells.json.
 * Used by FilterSmellsProvider.ts (modifies JSON based on user input).
 */
export interface FilterSmellConfig {
  name: string;
  message_id: string;
  acronym: string;
  enabled: boolean;
  analyzer_options?: Record<
    string,
    { label: string; description: string; value: number | string }
  >;
}

/**
 * Defines the structure of enabled smells sent to the backend.
 */
interface DetectSmellConfig {
  message_id: string;
  acronym: string;
  options: Record<string, string | number>;
}

/**
 * Loads the full smells configuration from smells.json.
 * @returns A dictionary of smells with their respective configuration.
 */
export function loadSmells(): Record<string, FilterSmellConfig> {
  const filePath = path.join(__dirname, '..', 'data', 'smells.json');

  if (!fs.existsSync(filePath)) {
    vscode.window.showErrorMessage(
      'Configuration file missing: smells.json could not be found.',
    );
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    vscode.window.showErrorMessage(
      'Error loading smells.json. Please check the file format.',
    );
    console.error('ERROR: Failed to parse smells.json', error);
    return {};
  }
}

/**
 * Saves the smells configuration to smells.json.
 * @param smells - The smells data to be saved.
 */
export function saveSmells(smells: Record<string, FilterSmellConfig>): void {
  const filePath = path.join(__dirname, '..', 'data', 'smells.json');
  try {
    fs.writeFileSync(filePath, JSON.stringify(smells, null, 2));
  } catch (error) {
    vscode.window.showErrorMessage('Error saving smells.json.');
    console.error('ERROR: Failed to write smells.json', error);
  }
}

/**
 * Extracts enabled smells from the loaded configuration.
 * @returns A dictionary of enabled smells formatted for backend processing.
 */
export function getEnabledSmells(): Record<string, DetectSmellConfig> {
  const smells = loadSmells();

  return Object.fromEntries(
    Object.entries(smells)
      .filter(([, smell]) => smell.enabled)
      .map(([smellKey, smellData]) => [
        smellKey,
        {
          message_id: smellData.message_id,
          acronym: smellData.acronym,
          options: Object.fromEntries(
            Object.entries(smellData.analyzer_options ?? {}).map(
              ([optionKey, optionData]) => [
                optionKey,
                typeof optionData.value === 'string' ||
                typeof optionData.value === 'number'
                  ? optionData.value
                  : String(optionData.value),
              ],
            ),
          ),
        },
      ]),
  );
}
