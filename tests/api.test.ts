import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { initDb, getDb } from '../src/db/database.js';
import { seedDatabase } from '../src/db/seed.js';

describe('Stellar Music Backend API Tests', () => {
  beforeAll(async () => {
    await initDb();
    await seedDatabase();
  });

  afterAll(async () => {
    const db = await getDb();
    await db.close();
  });

  describe('Health Check', () => {
    it('returns 200 and online status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('online');
      expect(res.body.network).toBe('Stellar Testnet');
    });
  });

  describe('Artists API', () => {
    it('retrieves seeded artists', async () => {
      const res = await request(app).get('/api/artists');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    });

    it('creates a new artist profile', async () => {
      const uniqueWallet = `GTESTARTIST_${Date.now()}`;
      const newArtist = {
        wallet_address: uniqueWallet,
        display_name: 'Test Artist Beat',
        bio: 'Electronic testing music artist',
      };
      const res = await request(app).post('/api/artists').send(newArtist);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.display_name).toBe(newArtist.display_name);
    });
  });

  describe('Tracks API', () => {
    it('retrieves published tracks', async () => {
      const res = await request(app).get('/api/tracks');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('creates a new track with draft/published state', async () => {
      const res = await request(app)
        .post('/api/tracks')
        .send({
          artist_id: 'artist-1',
          title: 'Stellar Pulse',
          description: 'A test sound track',
          audio_reference: '/uploads/stellar-pulse.mp3',
          artwork_reference: 'https://example.com/cover.jpg',
          price: 2.5,
          status: 'PUBLISHED',
          genre: 'Synthwave',
          duration_seconds: 190,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Stellar Pulse');
      expect(res.body.data.price).toBe(2.5);
    });

    it('rejects track creation with missing required fields', async () => {
      const res = await request(app)
        .post('/api/tracks')
        .send({
          title: 'Incomplete Track',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Streaming Access Control & Accounting', () => {
    it('allows access to free track without wallet or pass', async () => {
      // track-4 is seeded with price 0.0
      const res = await request(app).get('/api/tracks/track-4/stream');
      // Should attempt streaming or redirect to audio_reference
      expect([200, 302, 404]).toContain(res.status);
    });

    it('denies access to paid track when wallet has no Music Pass', async () => {
      // track-1 is seeded with price 2.0 XLM
      const res = await request(app).get('/api/tracks/track-1/stream?wallet=GUNKNOWN999999999999999999999999999999999999999999');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('MUSIC_PASS_REQUIRED');
      expect(res.body.price).toBe(2.0);
    });

    it('records and audits streaming sessions lifecycle', async () => {
      const listenerWallet = 'GLISTENER1111111111111111111111111111111111111111';

      // Start session on free track
      const startRes = await request(app)
        .post('/api/streams/start')
        .send({
          track_id: 'track-4',
          listener_wallet: listenerWallet,
        });

      expect(startRes.status).toBe(201);
      const sessionId = startRes.body.data.id;
      expect(sessionId).toBeDefined();

      // Send heartbeat
      const heartbeatRes = await request(app)
        .post(`/api/streams/${sessionId}/heartbeat`)
        .send({ duration_seconds: 15 });

      expect(heartbeatRes.status).toBe(200);
      expect(heartbeatRes.body.data.duration).toBe(15);

      // End session
      const endRes = await request(app)
        .post(`/api/streams/${sessionId}/end`)
        .send({ duration_seconds: 45 });

      expect(endRes.status).toBe(200);
      expect(endRes.body.data.status).toBe('COMPLETED');
      expect(endRes.body.data.duration).toBe(45);
    });
  });

  describe('Music Pass Replay & Duplicate Protection', () => {
    it('rejects unverified or invalid transaction hash', async () => {
      const res = await request(app)
        .post('/api/passes')
        .send({
          track_id: 'track-1',
          purchaser_wallet: 'GLISTENER1111111111111111111111111111111111111111',
          transaction_hash: '0000000000000000000000000000000000000000000000000000000000000000',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });
  });
});
