import { describe, it, expect } from 'vitest';
import { generateStreamToken, verifyStreamToken } from '../src/services/streamingToken.js';

describe('Level 1: Streaming Token Lifecycle & Cryptographic Security', () => {
  const secret = 'super_secret_cryptographic_test_key_123456';
  const trackId = 'test-track-999';
  const wallet = 'GASTRALDRIFT7777777777777777777777777777777777777777';

  it('generates a valid signed token that verifies successfully', () => {
    const token = generateStreamToken(trackId, wallet, 300, secret);
    const result = verifyStreamToken(token, secret);

    expect(result.valid).toBe(true);
    expect(result.payload?.trackId).toBe(trackId);
    expect(result.payload?.walletAddress).toBe(wallet);
  });

  it('rejects tokens when verified against an incorrect secret', () => {
    const token = generateStreamToken(trackId, wallet, 300, secret);
    const result = verifyStreamToken(token, 'wrong-secret-key-that-fails-verification');

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/signature/i);
  });

  it('detects tampering in token payload', () => {
    const token = generateStreamToken(trackId, wallet, 300, secret);
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const tampered = decoded.replace(trackId, 'tampered-track-id');
    const tamperedToken = Buffer.from(tampered).toString('base64url');

    const result = verifyStreamToken(tamperedToken, secret);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/signature/i);
  });

  it('rejects malformed token strings', () => {
    const result = verifyStreamToken('not-a-valid-token-format', secret);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/malformed/i);
  });

  it('rejects expired tokens immediately', () => {
    const token = generateStreamToken(trackId, wallet, -10, secret);
    const result = verifyStreamToken(token, secret);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/expired/i);
  });
});
