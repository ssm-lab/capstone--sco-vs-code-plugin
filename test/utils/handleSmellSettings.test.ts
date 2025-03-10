import * as vscode from 'vscode';
import {
  handleSmellFilterUpdate,
  getEnabledSmells,
  formatSmellName,
} from '../../src/utils/handleSmellSettings';
import { wipeWorkCache } from '../../src/commands/wipeWorkCache';
import { ContextManager } from '../../src/context/contextManager';
import vscodeMock from '../mocks/vscode-mock';

jest.mock('../../src/commands/wipeWorkCache', () => ({
  wipeWorkCache: jest.fn(),
}));

describe('Settings Page - handleSmellSettings.ts', () => {
  let contextManagerMock: ContextManager;

  beforeEach(() => {
    jest.clearAllMocks();
    contextManagerMock = {
      getWorkspaceData: jest.fn(),
      setWorkspaceData: jest.fn(),
    } as unknown as ContextManager;
  });

  describe('getEnabledSmells', () => {
    it('should return the current enabled smells from settings', () => {
      const mockSmells = {
        'cached-repeated-calls': true,
        'long-element-chain': false,
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValueOnce({
        get: jest.fn().mockReturnValue(mockSmells),
      } as any);

      const enabledSmells = getEnabledSmells();

      expect(enabledSmells).toEqual(mockSmells);
    });

    it('should return an empty object if no smells are set', () => {
      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValueOnce({
        get: jest.fn().mockReturnValue({}),
      } as any);

      const enabledSmells = getEnabledSmells();
      expect(enabledSmells).toEqual({});
    });
  });

  describe('handleSmellFilterUpdate', () => {
    it('should detect when a smell is enabled and notify the user', () => {
      const previousSmells = { 'cached-repeated-calls': false };
      const currentSmells = { 'cached-repeated-calls': true };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValueOnce({
        get: jest.fn().mockReturnValue(currentSmells),
      } as any);

      handleSmellFilterUpdate(previousSmells, contextManagerMock);

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Eco: Enabled detection of Cached Repeated Calls.',
      );
      expect(wipeWorkCache).toHaveBeenCalledWith(contextManagerMock, 'settings');
    });

    it('should detect when a smell is disabled and notify the user', () => {
      const previousSmells = { 'long-element-chain': true };
      const currentSmells = { 'long-element-chain': false };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValueOnce({
        get: jest.fn().mockReturnValue(currentSmells),
      } as any);

      handleSmellFilterUpdate(previousSmells, contextManagerMock);

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Eco: Disabled detection of Long Element Chain.',
      );
      expect(wipeWorkCache).toHaveBeenCalledWith(contextManagerMock, 'settings');
    });

    it('should not wipe cache if no smells changed', () => {
      const previousSmells = { 'cached-repeated-calls': true };
      const currentSmells = { 'cached-repeated-calls': true };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValueOnce({
        get: jest.fn().mockReturnValue(currentSmells),
      } as any);

      handleSmellFilterUpdate(previousSmells, contextManagerMock);

      expect(wipeWorkCache).not.toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });
  });

  describe('formatSmellName', () => {
    it('should format kebab-case smell names to a readable format', () => {
      expect(formatSmellName('cached-repeated-calls')).toBe('Cached Repeated Calls');
      expect(formatSmellName('long-element-chain')).toBe('Long Element Chain');
      expect(formatSmellName('string-concat-loop')).toBe('String Concat Loop');
    });

    it('should return an empty string if given an empty input', () => {
      expect(formatSmellName('')).toBe('');
    });
  });
});
