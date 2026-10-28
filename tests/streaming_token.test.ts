import { describe, it, expect } from 'vitest';
import { generateStreamToken, verifyStreamToken } from '../src/services/streamingToken.js';

describe('HMAC Streaming Token Service Tests', () => {
  const trackId = 'track-stellar-001';
  const walletAddress = 'GCMMDSL3RW5SHGAXEOW6G5M7KZ2CFWUPUKV5Q5L2NBTUA6F4RK45NE7F';

  it('generates a valid signed stream token', () => {
    const token = generateStreamToken(trackId, walletAddress, 3600);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);

    const verified = verifyStreamToken(token);
    expect(verified.valid).toBe(true);
    expect(verified.payload?.trackId).toBe(trackId);
    expect(verified.payload?.walletAddress).toBe(walletAddress);
  });

  it('rejects tampered stream tokens with invalid HMAC', () => {
    const token = generateStreamToken(trackId, walletAddress, 3600);
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const tampered = Buffer.from(decoded.replace(trackId, 'track-hacked-999')).toString('base64url');

    const verified = verifyStreamToken(tampered);
    expect(verified.valid).toBe(false);
    expect(verified.error).toBeDefined();
  });

  it('rejects expired stream tokens', () => {
    const expiredToken = generateStreamToken(trackId, walletAddress, -10);
    const verified = verifyStreamToken(expiredToken);
    expect(verified.valid).toBe(false);
    expect(verified.error).toContain('expired');
  });

  it('rejects tokens signed with a different secret', () => {
    const token = generateStreamToken(trackId, walletAddress, 3600, 'secret-a');
    const verified = verifyStreamToken(token, 'secret-b');
    expect(verified.valid).toBe(false);
  });
});
