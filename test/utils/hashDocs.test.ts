import { ContextManager } from '../../src/context/contextManager';

import { TextDocument } from '../mocks/vscode-mock';
import { updateHash } from '../../src/utils/hashDocs';

import crypto from 'crypto';

jest.mock('crypto');

describe('Hashing Tools', () => {
  let contextManagerMock: ContextManager;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock ContextManager
    contextManagerMock = {
      getWorkspaceData: jest.fn(),
      setWorkspaceData: jest.fn(),
    } as unknown as ContextManager;
  });

  it('should do nothing if the document hash has not changed', async () => {
    jest.spyOn(contextManagerMock, 'getWorkspaceData').mockReturnValueOnce({
      'fake.py': 'mocked-hash',
    });

    await updateHash(contextManagerMock, TextDocument as any);

    expect(crypto.createHash).toHaveBeenCalled();
    expect(contextManagerMock.setWorkspaceData).not.toHaveBeenCalled();
  });

  it('should update the workspace storage if the doc hash changed', async () => {
    jest.spyOn(contextManagerMock, 'getWorkspaceData').mockReturnValueOnce({
      'fake.py': 'someHash',
    });

    await updateHash(contextManagerMock, TextDocument as any);

    expect(crypto.createHash).toHaveBeenCalled();
    expect(contextManagerMock.setWorkspaceData).toHaveBeenCalled();
  });

  it('should update the workspace storage if no hash exists for the doc', async () => {
    jest.spyOn(contextManagerMock, 'getWorkspaceData').mockReturnValueOnce({
      'otherFake.py': 'someHash',
    });

    await updateHash(contextManagerMock, TextDocument as any);

    expect(crypto.createHash).toHaveBeenCalled();
    expect(contextManagerMock.setWorkspaceData).toHaveBeenCalled();
  });
});
