import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('API Route Validation Tests', () => {
  it('rejects POST /api/streams/start with missing listener_wallet', async () => {
    const res = await request(app)
      .post('/api/streams/start')
      .send({ track_id: 't1' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects POST /api/tracks/:id/splits with missing contributors', async () => {
    const res = await request(app)
      .post('/api/tracks/track-1/splits')
      .send({ created_by_wallet: 'G...' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
