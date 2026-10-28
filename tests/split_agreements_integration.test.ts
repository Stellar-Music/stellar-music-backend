import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { initDb } from '../src/db/database.js';
import { seedDatabase } from '../src/db/seed.js';

describe('Level 2: Revenue Split Agreements Integration Tests', () => {
  let sampleTrackId: string;

  beforeAll(async () => {
    await initDb();
    await seedDatabase();

    const tracksRes = await request(app).get('/api/tracks');
    sampleTrackId = tracksRes.body.data[0].id;
  });

  it('POST /api/tracks/:trackId/splits creates a new multi-contributor split agreement in AWAITING_SIGNATURES status', async () => {
    const payload = {
      created_by_wallet: 'GASTRALDRIFT7777777777777777777777777777777777777777',
      contributors: [
        {
          wallet_address: 'GASTRALDRIFT7777777777777777777777777777777777777777',
          display_name: 'Lead Artist',
          role: 'Artist',
          percentage: 70,
        },
        {
          wallet_address: 'GCONTRIBUTOR1111111111111111111111111111111111111111',
          display_name: 'Producer',
          role: 'Producer',
          percentage: 30,
        },
      ],
    };

    const res = await request(app).post(`/api/tracks/${sampleTrackId}/splits`).send(payload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.agreement.status).toBe('AWAITING_SIGNATURES');
    expect(res.body.data.contributors.length).toBe(2);
  });

  it('GET /api/tracks/:trackId/splits retrieves active agreements for track', async () => {
    const res = await request(app).get(`/api/tracks/${sampleTrackId}/splits`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
