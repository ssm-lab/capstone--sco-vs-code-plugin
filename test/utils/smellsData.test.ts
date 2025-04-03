// smellsData.test.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  loadSmells,
  saveSmells,
  getFilterSmells,
  getEnabledSmells,
  getAcronymByMessageId,
  getNameByMessageId,
  getDescriptionByMessageId,
  FilterSmellConfig,
} from '../../src/utils/smellsData';

// Mock the modules
jest.mock('vscode');
jest.mock('fs');
jest.mock('path');

const mockSmellsConfig: Record<string, FilterSmellConfig> = {
  'long-parameter-list': {
    name: 'Long Parameter List',
    message_id: 'R0913',
    acronym: 'LPL',
    smell_description: 'Method has too many parameters',
    enabled: true,
    analyzer_options: {
      max_params: {
        label: 'Maximum Parameters',
        description: 'Maximum allowed parameters',
        value: 5,
      },
    },
  },
  'duplicate-code': {
    name: 'Duplicate Code',
    message_id: 'R0801',
    acronym: 'DC',
    smell_description: 'Code duplication detected',
    enabled: false,
  },
};

// Mock console.error to prevent test output pollution
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('smellsData', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockSmellsConfig));
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

    // Mock path.join to return predictable paths
    (path.join as jest.Mock).mockImplementation((...args: string[]) =>
      args.join('/').replace(/\\/g, '/'),
    );
  });

  describe('loadSmells', () => {
    it('should load smells configuration successfully', () => {
      loadSmells('working');

      // Update path expectation to match actual implementation
      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('data/working_smells_config.json'),
        'utf-8',
      );
      expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });

    it('should show error message when file is missing', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      loadSmells('working');

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Configuration file missing: smells.json could not be found.',
      );
    });

    it('should show error message when file parsing fails', () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Parse error');
      });

      loadSmells('working');

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Error loading smells.json. Please check the file format.',
      );
      expect(console.error).toHaveBeenCalledWith(
        'ERROR: Failed to parse smells.json',
        expect.any(Error),
      );
    });
  });

  describe('saveSmells', () => {
    it('should save smells configuration successfully', () => {
      saveSmells(mockSmellsConfig);

      // Update path expectation to match actual implementation
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('data/working_smells_config.json'),
        JSON.stringify(mockSmellsConfig, null, 2),
      );
      expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });

    it('should show error message when file write fails', () => {
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Write error');
      });

      saveSmells(mockSmellsConfig);

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Error saving smells.json.',
      );
      expect(console.error).toHaveBeenCalledWith(
        'ERROR: Failed to write smells.json',
        expect.any(Error),
      );
    });
  });

  describe('getFilterSmells', () => {
    it('should return the loaded filter smells', () => {
      loadSmells('working');
      const result = getFilterSmells();

      expect(result).toEqual(mockSmellsConfig);
    });
  });

  describe('getEnabledSmells', () => {
    it('should return only enabled smells with parsed options', () => {
      loadSmells('working');
      const result = getEnabledSmells();

      expect(result).toEqual({
        'long-parameter-list': {
          message_id: 'R0913',
          acronym: 'LPL',
          options: {
            max_params: 5,
          },
        },
      });
    });
  });

  describe('getAcronymByMessageId', () => {
    it('should return the correct acronym for a message ID', () => {
      loadSmells('working');
      const result = getAcronymByMessageId('R0913');

      expect(result).toBe('LPL');
    });

    it('should return undefined for unknown message ID', () => {
      loadSmells('working');
      const result = getAcronymByMessageId('UNKNOWN');

      expect(result).toBeUndefined();
    });
  });

  describe('getNameByMessageId', () => {
    it('should return the correct name for a message ID', () => {
      loadSmells('working');
      const result = getNameByMessageId('R0913');

      expect(result).toBe('Long Parameter List');
    });

    it('should return undefined for unknown message ID', () => {
      loadSmells('working');
      const result = getNameByMessageId('UNKNOWN');

      expect(result).toBeUndefined();
    });
  });

  describe('getDescriptionByMessageId', () => {
    it('should return the correct description for a message ID', () => {
      loadSmells('working');
      const result = getDescriptionByMessageId('R0913');

      expect(result).toBe('Method has too many parameters');
    });

    it('should return undefined for unknown message ID', () => {
      loadSmells('working');
      const result = getDescriptionByMessageId('UNKNOWN');

      expect(result).toBeUndefined();
    });
  });
});
