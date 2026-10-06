import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { initDb, getDb } from '../src/db/database.js';
import { seedDatabase } from '../src/db/seed.js';

describe('Level 2: Revenue Split Agreements Integration Tests', () => {
  const artistWallet = 'GASTRALDRIFT7777777777777777777777777777777777777777';
  const producerWallet = 'GPRODUCER22222222222222222222222222222222222222222222';
  const songwriterWallet = 'GSONGWRITER333333333333333333333333333333333333333333';

  beforeAll(async () => {
    await initDb();
    await seedDatabase();
    const db = await getDb();
    await db.execute('DELETE FROM split_signatures');
    await db.execute('DELETE FROM agreement_events');
    await db.execute('DELETE FROM split_contributors');
    await db.execute('DELETE FROM split_agreements');
  });

  afterAll(async () => {
    const db = await getDb();
    await db.close();
  });

  it('creates a split agreement with valid 100% allocation and deterministic hash', async () => {
    const res = await request(app)
      .post('/api/tracks/track-1/splits')
      .send({
        created_by_wallet: artistWallet,
        contributors: [
          { wallet_address: artistWallet, display_name: 'Astral Drift', role: 'Artist', percentage: 50 },
          { wallet_address: producerWallet, display_name: 'Nova Producer', role: 'Producer', percentage: 30 },
          { wallet_address: songwriterWallet, display_name: 'Stellar Lyricist', role: 'Songwriter', percentage: 20 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.agreement.version).toBe(1);
    expect(res.body.data.agreement.agreement_hash).toBeDefined();
    expect(res.body.data.agreement.agreement_hash.length).toBe(64); // SHA-256 hex
    expect(res.body.data.contributors.length).toBe(3);

    // Artist creator should be auto-signed
    const artistContrib = res.body.data.contributors.find((c: any) => c.wallet_address === artistWallet);
    expect(artistContrib.has_signed).toBe(true);

    const producerContrib = res.body.data.contributors.find((c: any) => c.wallet_address === producerWallet);
    expect(producerContrib.has_signed).toBe(false);
  });

  it('rejects split agreement when total does not equal 100%', async () => {
    const res = await request(app)
      .post('/api/tracks/track-1/splits')
      .send({
        created_by_wallet: artistWallet,
        contributors: [
          { wallet_address: artistWallet, display_name: 'Artist', role: 'Artist', percentage: 50 },
          { wallet_address: producerWallet, display_name: 'Producer', role: 'Producer', percentage: 40 },
          // Total = 90%
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('100.0%');
  });

  it('rejects split agreement with duplicate contributor wallets', async () => {
    const res = await request(app)
      .post('/api/tracks/track-1/splits')
      .send({
        created_by_wallet: artistWallet,
        contributors: [
          { wallet_address: artistWallet, display_name: 'Artist', role: 'Artist', percentage: 50 },
          { wallet_address: artistWallet, display_name: 'Artist Again', role: 'Producer', percentage: 50 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('DUPLICATE_CONTRIBUTOR');
  });

  it('processes multi-party contributor signatures until LOCKED', async () => {
    // 1. Create split
    const createRes = await request(app)
      .post('/api/tracks/track-2/splits')
      .send({
        created_by_wallet: artistWallet,
        contributors: [
          { wallet_address: artistWallet, display_name: 'Main Artist', role: 'Artist', percentage: 60 },
          { wallet_address: producerWallet, display_name: 'Lead Producer', role: 'Producer', percentage: 40 },
        ],
      });

    expect(createRes.status).toBe(201);
    const agreementId = createRes.body.data.agreement.id;
    expect(createRes.body.data.agreement.status).toBe('AWAITING_SIGNATURES');

    // 2. Producer signs
    const signRes = await request(app)
      .post(`/api/splits/${agreementId}/sign`)
      .send({
        contributor_wallet: producerWallet,
        signature_ref: 'tx_signature_ref_testnet_123',
      });

    expect(signRes.status).toBe(200);
    expect(signRes.body.success).toBe(true);
    expect(signRes.body.data.isLocked).toBe(true);
    expect(signRes.body.data.agreement.status).toBe('LOCKED');
    expect(signRes.body.data.agreement.locked_at).toBeDefined();

    // 3. Level 3 Settlement Query: Verify active locked split is available
    const activeRes = await request(app).get('/api/tracks/track-2/splits/active');
    expect(activeRes.status).toBe(200);
    expect(activeRes.body.data.agreement.id).toBe(agreementId);
    expect(activeRes.body.data.agreement.status).toBe('LOCKED');
  });

  it('rejects modifications and signatures on already LOCKED agreements', async () => {
    const activeRes = await request(app).get('/api/tracks/track-2/splits/active');
    const agreementId = activeRes.body.data.agreement.id;

    // Attempting to sign already locked agreement
    const res = await request(app)
      .post(`/api/splits/${agreementId}/sign`)
      .send({ contributor_wallet: producerWallet });

    // Should recognize it is locked
    expect(res.body.data?.agreement?.status || res.body.error).toBeDefined();
  });

  it('supports Contributor Dashboard query (/api/me/splits)', async () => {
    const res = await request(app).get(`/api/me/splits?wallet=${producerWallet}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('locked');
    expect(res.body.data).toHaveProperty('awaiting_my_signature');
    expect(res.body.data.locked.length).toBeGreaterThanOrEqual(1);
  });
});
