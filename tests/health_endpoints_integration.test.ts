import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Level 1: System Health Probes Integration Tests', () => {
  it('GET /api/health returns 200 with service information and network target', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('online');
    expect(res.body.service).toBe('stellar-music-backend');
    expect(res.body.network).toBe('Stellar Testnet');
  });

  it('GET /api/health/db returns 200 and confirms database responsiveness', async () => {
    const res = await request(app).get('/api/health/db');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.component).toBe('database');
    expect(res.body.alive).toBe(true);
  });

  it('GET /api/health/stellar returns 200 and checks horizon connectivity', async () => {
    const res = await request(app).get('/api/health/stellar');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
  });

  it('GET /api/docs.json serves valid OpenAPI 3.0 specification', async () => {
    const res = await request(app).get('/api/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.info.title).toBe('Stellar Music Core API');
  });
});
