import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { initDb } from '../src/db/database.js';
import { seedDatabase } from '../src/db/seed.js';

describe('Level 3: Settlement History & Reporting Integration Tests', () => {
  beforeAll(async () => {
    await initDb();
    await seedDatabase();
  });

  it('GET /api/settlements returns historical settlement receipts', async () => {
    const res = await request(app).get('/api/settlements');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/settlements/export returns RFC 4180 CSV file', async () => {
    const res = await request(app).get('/api/settlements/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.text).toContain('Settlement ID,Track ID,Pool ID,Asset,Gross Amount');
  });

  it('GET /api/revenue/pending returns pending revenue allocations', async () => {
    const res = await request(app).get('/api/revenue/pending');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('total_pending_xlm');
    expect(Array.isArray(res.body.data.pending_tracks)).toBe(true);
  });
});
