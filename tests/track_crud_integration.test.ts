import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { initDb } from '../src/db/database.js';
import { seedDatabase } from '../src/db/seed.js';

describe('Level 1: Track CRUD & Discovery Integration Tests', () => {
  beforeAll(async () => {
    await initDb();
    await seedDatabase();
  });

  it('GET /api/tracks lists all available tracks', async () => {
    const res = await request(app).get('/api/tracks');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/tracks filters by genre', async () => {
    const res = await request(app).get('/api/tracks?genre=Electronic');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    for (const track of res.body.data) {
      expect(track.genre).toBe('Electronic');
    }
  });

  it('GET /api/tracks searches by keyword', async () => {
    const res = await request(app).get('/api/tracks?search=Cosmic');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.some((t: any) => t.title.includes('Cosmic'))).toBe(true);
  });

  it('GET /api/tracks/:id returns 404 for nonexistent track ID', async () => {
    const res = await request(app).get('/api/tracks/nonexistent-id-000');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
