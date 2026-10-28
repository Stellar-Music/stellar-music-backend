import { describe, it, expect } from 'vitest';
import { parseByteRange } from '../src/services/rangeParser.js';

describe('HTTP 206 Byte Range Parser Tests', () => {
  const totalSize = 1000000; // 1MB

  it('parses standard range bytes=0-1023', () => {
    const range = parseByteRange('bytes=0-1023', totalSize);
    expect(range).not.toBeNull();
    expect(range?.start).toBe(0);
    expect(range?.end).toBe(1023);
    expect(range?.chunkLength).toBe(1024);
    expect(range?.contentRangeHeader).toBe('bytes 0-1023/1000000');
  });

  it('parses prefix range bytes=5000-', () => {
    const range = parseByteRange('bytes=5000-', totalSize);
    expect(range).not.toBeNull();
    expect(range?.start).toBe(5000);
    expect(range?.end).toBe(999999);
    expect(range?.chunkLength).toBe(995000);
  });

  it('parses suffix range bytes=-2048', () => {
    const range = parseByteRange('bytes=-2048', totalSize);
    expect(range).not.toBeNull();
    expect(range?.start).toBe(totalSize - 2048);
    expect(range?.end).toBe(totalSize - 1);
    expect(range?.chunkLength).toBe(2048);
  });

  it('clamps range end to totalSize - 1 if exceeding file size', () => {
    const range = parseByteRange('bytes=900000-2000000', totalSize);
    expect(range).not.toBeNull();
    expect(range?.start).toBe(900000);
    expect(range?.end).toBe(999999);
  });

  it('returns null for missing or invalid range header format', () => {
    expect(parseByteRange(undefined, totalSize)).toBeNull();
    expect(parseByteRange('characters=0-100', totalSize)).toBeNull();
    expect(parseByteRange('bytes=abc-def', totalSize)).toBeNull();
    expect(parseByteRange('bytes=500-100', totalSize)).toBeNull();
    expect(parseByteRange('bytes=2000000-', totalSize)).toBeNull();
  });
});
