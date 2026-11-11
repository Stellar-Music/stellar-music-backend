import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { seedDatabase } from '../src/db/seed.js';

describe('Streaming Token Endpoint Tests', () => {
  beforeAll(async () => {
    await seedDatabase();
  });

  it('generates a signed stream token via POST /api/streams/token for free or unseeded track', async () => {
    const res = await request(app).post('/api/streams/token').send({
      track_id: 'track-4', // free track in seed
      wallet_address: 'GCMMDSL3RW5SHGAXEOW6G5M7KZ2CFWUPUKV5Q5L2NBTUA6F4RK45NE7F',
      ttl_seconds: 1800,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.track_id).toBe('track-4');
    expect(res.body.data.expires_in).toBe(1800);
  });

  it('rejects POST /api/streams/token without track_id or wallet_address', async () => {
    const res = await request(app).post('/api/streams/token').send({ track_id: 'track-test-1' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects POST /api/streams/token for paid track when wallet has no pass', async () => {
    const res = await request(app).post('/api/streams/token').send({
      track_id: 'track-1', // paid track (2.0 XLM)
      wallet_address: 'GCLVNRJ22M642S4L7FOWX52W4R5JYYZ375753SXZ6Y4P67F6M4X4GNRK',
    });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('MUSIC_PASS_REQUIRED');
  });

  it('blocks direct access to audio files under /uploads with 403 Forbidden', async () => {
    const res = await request(app).get('/uploads/audio-secret.mp3');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('DIRECT_AUDIO_ACCESS_FORBIDDEN');
  });

  it('rejects GET /api/streams/:trackId/play for paid track without stream token', async () => {
    const res = await request(app).get('/api/streams/track-1/play');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Missing streaming access token/);
  });
});
