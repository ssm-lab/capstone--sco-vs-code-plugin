// utils/trackedDiffEditors.test.ts
import * as vscode from 'vscode';
import {
  registerDiffEditor,
  isTrackedDiffEditor,
  closeAllTrackedDiffEditors,
  trackedDiffs,
} from '../../src/utils/trackedDiffEditors';

// Mock the vscode API
jest.mock('vscode', () => ({
  window: {
    tabGroups: {
      close: jest.fn().mockResolvedValue(true),
      all: [],
    },
  },
  Uri: {
    parse: jest.fn(),
  },
}));

describe('trackedDiffEditors', () => {
  const mockUri1 = { toString: () => 'file:///test1.txt' } as vscode.Uri;
  const mockUri2 = { toString: () => 'file:///test2.txt' } as vscode.Uri;
  const mockUri3 = { toString: () => 'file:///test3.txt' } as vscode.Uri;

  beforeEach(() => {
    // Clear the trackedDiffs set before each test
    trackedDiffs.clear();
    // Reset the mock implementation
    (vscode.window.tabGroups.close as jest.Mock).mockClear().mockResolvedValue(true);
    // Reset tab groups mock
    (vscode.window.tabGroups.all as any) = [];
  });

  describe('registerDiffEditor', () => {
    it('should register a diff editor with given URIs', () => {
      registerDiffEditor(mockUri1, mockUri2);
      expect(isTrackedDiffEditor(mockUri1, mockUri2)).toBe(true);
    });

    it('should not register unrelated URIs', () => {
      registerDiffEditor(mockUri1, mockUri2);
      expect(isTrackedDiffEditor(mockUri1, mockUri3)).toBe(false);
      expect(isTrackedDiffEditor(mockUri2, mockUri3)).toBe(false);
    });
  });

  describe('isTrackedDiffEditor', () => {
    it('should return true for registered diff editors', () => {
      registerDiffEditor(mockUri1, mockUri2);
      expect(isTrackedDiffEditor(mockUri1, mockUri2)).toBe(true);
    });

    it('should return false for unregistered diff editors', () => {
      expect(isTrackedDiffEditor(mockUri1, mockUri2)).toBe(false);
    });

    it('should be case sensitive for URIs', () => {
      const mockUriLower = { toString: () => 'file:///test1.txt' } as vscode.Uri;
      const mockUriUpper = { toString: () => 'FILE:///TEST1.TXT' } as vscode.Uri;
      registerDiffEditor(mockUriLower, mockUri2);
      expect(isTrackedDiffEditor(mockUriUpper, mockUri2)).toBe(false);
    });
  });

  describe('closeAllTrackedDiffEditors', () => {
    it('should close all tracked diff editors', async () => {
      // Setup mock tabs
      const mockTab1 = {
        input: { original: mockUri1, modified: mockUri2 },
      };
      const mockTab2 = {
        input: { original: mockUri3, modified: mockUri2 },
      };
      const mockTab3 = {
        input: { somethingElse: true },
      };

      // Mock the tabGroups.all
      (vscode.window.tabGroups.all as any) = [
        { tabs: [mockTab1, mockTab2] },
        { tabs: [mockTab3] },
      ];

      registerDiffEditor(mockUri1, mockUri2);

      await closeAllTrackedDiffEditors();

      expect(vscode.window.tabGroups.close).toHaveBeenCalledTimes(1);
      expect(vscode.window.tabGroups.close).toHaveBeenCalledWith(mockTab1, true);
    });

    it('should clear all tracked diffs after closing', async () => {
      registerDiffEditor(mockUri1, mockUri2);
      (vscode.window.tabGroups.all as any) = [];

      await closeAllTrackedDiffEditors();

      expect(isTrackedDiffEditor(mockUri1, mockUri2)).toBe(false);
    });

    it('should handle empty tabs', async () => {
      // Ensure no tabs exist
      (vscode.window.tabGroups.all as any) = [];
      // Don't register any editors for this test

      await closeAllTrackedDiffEditors();

      expect(vscode.window.tabGroups.close).not.toHaveBeenCalled();
      expect(trackedDiffs.size).toBe(0);
    });
  });
});
