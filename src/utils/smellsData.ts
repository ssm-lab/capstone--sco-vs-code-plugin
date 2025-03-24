import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ecoOutput } from '../extension';

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

let filterSmells: Record<string, FilterSmellConfig>;
let enabledSmells: Record<string, DetectSmellConfig>;

/**
 * Loads the full smells configuration from smells.json.
 * @returns A dictionary of smells with their respective configuration.
 */
export function loadSmells(): void {
  const filePath = path.join(__dirname, '..', 'data', 'smells.json');

  if (!fs.existsSync(filePath)) {
    vscode.window.showErrorMessage(
      'Configuration file missing: smells.json could not be found.',
    );
  }

  try {
    filterSmells = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    enabledSmells = parseSmells(filterSmells);

    ecoOutput.appendLine('\nSmells loaded\n');
  } catch (error) {
    vscode.window.showErrorMessage(
      'Error loading smells.json. Please check the file format.',
    );
    console.error('ERROR: Failed to parse smells.json', error);
  }
}

/**
 * Saves the smells configuration to smells.json.
 * @param smells - The smells data to be saved.
 */
export function saveSmells(smells: Record<string, FilterSmellConfig>): void {
  filterSmells = smells;

  const filePath = path.join(__dirname, '..', 'data', 'smells.json');
  try {
    fs.writeFileSync(filePath, JSON.stringify(smells, null, 2));

    enabledSmells = parseSmells(filterSmells);
  } catch (error) {
    vscode.window.showErrorMessage('Error saving smells.json.');
    console.error('ERROR: Failed to write smells.json', error);
  }
}

/**
 * Extracts raw smells data from the loaded configuration.
 * @returns A dictionary of smell config data for smell filtering.
 */
export function getFilterSmells(): Record<string, FilterSmellConfig> {
  return filterSmells;
}

/**
 * Extracts enabled smells from the loaded configuration.
 * @returns A dictionary of enabled smells formatted for backend processing.
 */
export function getEnabledSmells(): Record<string, DetectSmellConfig> {
  return enabledSmells;
}

/**
 * Parses the raw smells into a formatted object.
 * @param smells - The smells data to be saved.
 * @returns A dictionary of enabled smells formatted for backend processing.
 */
function parseSmells(
  smells: Record<string, FilterSmellConfig>,
): Record<string, DetectSmellConfig> {
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

/**
 * Returns the acronym for a given message ID.
 * @param messageId - The message ID to look up (e.g., "R0913").
 * @returns The acronym (e.g., "LPL") or undefined if not found.
 */
export function getAcronymByMessageId(messageId: string): string | undefined {
  const match = Object.values(filterSmells).find(
    (smell) => smell.message_id === messageId,
  );
  return match?.acronym;
}
