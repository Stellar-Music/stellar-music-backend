import { describe, it, expect } from 'vitest';
import { parseByteRange } from '../src/services/rangeParser.js';

describe('Level 1: HTTP 206 Byte-Range Parser Edge Cases', () => {
  const totalFileSize = 10_000_000; // 10MB audio file

  it('parses standard range header bytes=0-1023', () => {
    const range = parseByteRange('bytes=0-1023', totalFileSize);
    expect(range).not.toBeNull();
    expect(range?.start).toBe(0);
    expect(range?.end).toBe(1023);
    expect(range?.chunkLength).toBe(1024);
  });

  it('parses open-ended range bytes=1000-', () => {
    const range = parseByteRange('bytes=1000-', totalFileSize);
    expect(range).not.toBeNull();
    expect(range?.start).toBe(1000);
    expect(range?.end).toBe(totalFileSize - 1);
    expect(range?.chunkLength).toBe(totalFileSize - 1000);
  });

  it('parses suffix range bytes=-500 (last 500 bytes)', () => {
    const range = parseByteRange('bytes=-500', totalFileSize);
    expect(range).not.toBeNull();
    expect(range?.start).toBe(totalFileSize - 500);
    expect(range?.end).toBe(totalFileSize - 1);
    expect(range?.chunkLength).toBe(500);
  });

  it('clamps end byte if requested beyond file boundary', () => {
    const range = parseByteRange(`bytes=0-${totalFileSize + 5000}`, totalFileSize);
    expect(range).not.toBeNull();
    expect(range?.start).toBe(0);
    expect(range?.end).toBe(totalFileSize - 1);
  });

  it('returns null for syntactically invalid or non-byte range headers', () => {
    expect(parseByteRange('seconds=0-10', totalFileSize)).toBeNull();
    expect(parseByteRange('invalid-range', totalFileSize)).toBeNull();
    expect(parseByteRange(undefined, totalFileSize)).toBeNull();
  });

  it('returns null when start byte exceeds total size (416 Range Not Satisfiable)', () => {
    expect(parseByteRange(`bytes=${totalFileSize + 1000}-`, totalFileSize)).toBeNull();
  });
});
