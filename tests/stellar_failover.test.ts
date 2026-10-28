import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StellarService } from '../src/services/stellar.service.js';

describe('StellarService Failover RPC Pool', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('initializes with primary and fallback endpoints', () => {
    const service = new StellarService([
      'https://primary.horizon',
      'https://fallback.horizon',
    ]);
    const status = service.getRpcStatus();
    expect(status.activeEndpoint).toBe('https://primary.horizon');
    expect(status.endpoints).toEqual(['https://primary.horizon', 'https://fallback.horizon']);
  });

  it('fetches transaction from primary server when healthy', async () => {
    const service = new StellarService([
      'https://primary.horizon',
      'https://fallback.horizon',
    ]);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'tx_123', successful: true }),
    } as any);

    const tx = await service.getTransaction('tx_123');
    expect(tx).toEqual({ id: 'tx_123', successful: true });
    expect(global.fetch).toHaveBeenCalledWith('https://primary.horizon/transactions/tx_123');
    expect(service.getRpcStatus().activeEndpoint).toBe('https://primary.horizon');
  });

  it('fails over to secondary server when primary throws a 503 error', async () => {
    const service = new StellarService([
      'https://primary.horizon',
      'https://fallback.horizon',
    ]);

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      if (url.startsWith('https://primary.horizon')) {
        return { ok: false, status: 503 };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'tx_fallback', successful: true }),
      };
    });

    const tx = await service.getTransaction('tx_fallback');
    expect(tx).toEqual({ id: 'tx_fallback', successful: true });
    expect(callCount).toBe(2);
    expect(service.getRpcStatus().activeEndpoint).toBe('https://fallback.horizon');
  });

  it('fails over to secondary server on network timeout/connection exception', async () => {
    const service = new StellarService([
      'https://primary.horizon',
      'https://fallback.horizon',
    ]);

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      if (url.startsWith('https://primary.horizon')) {
        throw new Error('ECONNREFUSED / Network Timeout');
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ _embedded: { records: [{ type: 'payment', amount: '10' }] } }),
      };
    });

    const ops = await service.getTransactionOperations('tx_abc');
    expect(ops.length).toBe(1);
    expect(callCount).toBe(2);
    expect(service.getRpcStatus().activeEndpoint).toBe('https://fallback.horizon');
  });
});
