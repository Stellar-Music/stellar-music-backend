import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Health and Security Middleware Tests', () => {
  it('GET /api/health returns online service status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('online');
    expect(res.body.service).toBe('stellar-music-backend');
    expect(res.body.network).toBe('Stellar Testnet');
  });

  it('GET /api/health/db verifies database connectivity', async () => {
    const res = await request(app).get('/api/health/db');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.alive).toBe(true);
  });

  it('GET /api/health/stellar verifies horizon endpoint connectivity or mock fallback', async () => {
    const res = await request(app).get('/api/health/stellar');
    expect(res.status).toBe(200);
    expect(['connected', 'degraded', 'simulated']).toContain(res.body.status);
    expect(res.body.component).toBe('stellar-horizon');
  });

  it('injects x-request-id correlation tracing header', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id'].length).toBeGreaterThan(10);
  });

  it('preserves incoming x-request-id if provided by client', async () => {
    const customId = 'test-trace-id-12345';
    const res = await request(app)
      .get('/api/health')
      .set('x-request-id', customId);
    expect(res.headers['x-request-id']).toBe(customId);
  });

  it('includes Helmet security headers in responses', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('includes rate limiting headers in responses', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
  });
});
