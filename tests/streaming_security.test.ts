import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Streaming Token Endpoint Tests', () => {
  it('generates a signed stream token via POST /api/streams/token', async () => {
    const res = await request(app)
      .post('/api/streams/token')
      .send({
        track_id: 'track-test-1',
        wallet_address: 'GCMMDSL3RW5SHGAXEOW6G5M7KZ2CFWUPUKV5Q5L2NBTUA6F4RK45NE7F',
        ttl_seconds: 1800,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.track_id).toBe('track-test-1');
    expect(res.body.data.expires_in).toBe(1800);
  });

  it('rejects POST /api/streams/token without track_id or wallet_address', async () => {
    const res = await request(app)
      .post('/api/streams/token')
      .send({ track_id: 'track-test-1' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
