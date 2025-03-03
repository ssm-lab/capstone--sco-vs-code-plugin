// __mocks__/crypto.ts
export default {
  createHash: jest.fn(() => ({
    update: jest.fn(() => ({
      digest: jest.fn(() => 'mocked-hash'),
    })),
  })),
};
