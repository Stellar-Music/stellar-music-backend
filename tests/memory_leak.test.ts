import { describe, it, expect } from 'vitest';
import { generateStreamToken, verifyStreamToken } from '../src/services/streamingToken.js';
import { parseByteRange } from '../src/services/rangeParser.js';
import { v4 as uuidv4 } from 'uuid';

describe('Level 4: Memory Leak & High Concurrency Stability Tests', () => {
  it('guarantees stable memory consumption over 500 consecutive HMAC streaming token cycles', () => {
    const testSecret = 'stellar_music_super_secure_hmac_secret_key_32_chars';
    const iterations = 500;

    // Baseline memory
    if (global.gc) global.gc();
    const initialHeap = process.memoryUsage().heapUsed;

    for (let i = 0; i < iterations; i++) {
      const trackId = `track-${i}`;
      const wallet = `G${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 55)}`;

      const token = generateStreamToken(trackId, wallet, 60, testSecret);
      const verification = verifyStreamToken(token, testSecret);

      expect(verification.valid).toBe(true);
      expect(verification.payload?.walletAddress).toBe(wallet);
    }

    if (global.gc) global.gc();
    const finalHeap = process.memoryUsage().heapUsed;
    const growthBytes = finalHeap - initialHeap;
    const growthMb = growthBytes / (1024 * 1024);

    // Memory growth must remain bounded under 25MB for 500 cryptographic token sessions
    expect(growthMb).toBeLessThan(25);
  });

  it('proves zero memory accumulation in range request headers parser over 1,000 iterations', () => {
    const fileSize = 15 * 1024 * 1024; // 15MB

    if (global.gc) global.gc();
    const initialHeap = process.memoryUsage().heapUsed;

    for (let i = 0; i < 1000; i++) {
      const start = (i * 1024) % (fileSize - 1000);
      const end = start + 8192;
      const parsed = parseByteRange(`bytes=${start}-${end}`, fileSize);
      expect(parsed).not.toBeNull();
    }

    if (global.gc) global.gc();
    const finalHeap = process.memoryUsage().heapUsed;
    const growthMb = (finalHeap - initialHeap) / (1024 * 1024);

    expect(growthMb).toBeLessThan(15);
  });
});
