import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { initDb, getDb } from '../src/db/database.js';
import { seedDatabase } from '../src/db/seed.js';

describe('Level 3: Automated Revenue Settlement Engine Tests', () => {
  const artistWallet = 'GASTRALDRIFT7777777777777777777777777777777777777777';
  const producerWallet = 'GPRODUCER22222222222222222222222222222222222222222222';
  const songwriterWallet = 'GSONGWRITER333333333333333333333333333333333333333333';

  beforeAll(async () => {
    await initDb();
    await seedDatabase();
    const db = await getDb();
    await db.execute('DELETE FROM settlement_recipients');
    await db.execute('DELETE FROM settlements');
    await db.execute('DELETE FROM revenue_pools');
    await db.execute('DELETE FROM split_signatures');
    await db.execute('DELETE FROM agreement_events');
    await db.execute('DELETE FROM split_contributors');
    await db.execute('DELETE FROM split_agreements');
  });

  afterAll(async () => {
    const db = await getDb();
    await db.close();
  });

  it('records revenue into a pool and preserves accounting invariant', async () => {
    const { settlementService } = await import('../src/services/settlement.service.js');
    const pool = await settlementService.recordRevenueToPool(100, 'XLM', 'tx-test-pool-1');

    expect(pool).toBeDefined();
    expect(pool.total_amount).toBe(100);
    expect(pool.unallocated_amount).toBe(100);
    expect(pool.allocated_amount).toBe(0);
    // Invariant: total = allocated + unallocated
    expect(pool.total_amount).toBe(pool.allocated_amount + pool.unallocated_amount);
  });

  it('rejects settlement when track has no active LOCKED split agreement', async () => {
    const res = await request(app)
      .post('/api/settlements/track/track-1')
      .send({ amount: 50 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('NO_LOCKED_AGREEMENT');
  });

  it('executes multi-recipient settlement using the locked agreement as source of truth', async () => {
    // 1. Create a Level 2 split agreement
    const createRes = await request(app)
      .post('/api/tracks/track-1/splits')
      .send({
        created_by_wallet: artistWallet,
        contributors: [
          { wallet_address: artistWallet, display_name: 'Astral Drift', role: 'Artist', percentage: 50 },
          { wallet_address: producerWallet, display_name: 'Nova Producer', role: 'Producer', percentage: 30 },
          { wallet_address: songwriterWallet, display_name: 'Stellar Lyricist', role: 'Songwriter', percentage: 20 },
        ],
      });

    expect(createRes.status).toBe(201);
    const agreementId = createRes.body.data.agreement.id;

    // 2. Both required contributors sign -> Agreement LOCKS
    await request(app).post(`/api/splits/${agreementId}/sign`).send({ contributor_wallet: producerWallet });
    const signRes = await request(app).post(`/api/splits/${agreementId}/sign`).send({ contributor_wallet: songwriterWallet });
    expect(signRes.body.data.isLocked).toBe(true);

    // 3. Level 3: Execute settlement for 100 XLM
    const settleRes = await request(app)
      .post('/api/settlements/track/track-1')
      .send({ amount: 100 });

    expect(settleRes.status).toBe(201);
    expect(settleRes.body.success).toBe(true);
    expect(settleRes.body.data.settlement.status).toBe('SETTLED');
    expect(settleRes.body.data.settlement.tx_hash).toBeDefined();

    const recipients = settleRes.body.data.recipients;
    expect(recipients.length).toBe(3);

    // Verify percentages from the locked agreement:
    const artist = recipients.find((r: any) => r.wallet_address === artistWallet);
    const producer = recipients.find((r: any) => r.wallet_address === producerWallet);
    const songwriter = recipients.find((r: any) => r.wallet_address === songwriterWallet);

    expect(artist.actual_amount).toBe(50);
    expect(producer.actual_amount).toBe(30);
    expect(songwriter.actual_amount).toBe(20);

    // Financial invariant: Sum(recipients) === gross_amount
    const totalPayouts = recipients.reduce((acc: number, r: any) => acc + r.actual_amount, 0);
    expect(totalPayouts).toBe(100);
  });

  it('guarantees integer-exact remainder handling with zero leakage on odd splits', async () => {
    // Settle 33.33 XLM across the 50/30/20 split
    const res = await request(app)
      .post('/api/settlements/track/track-1')
      .send({ amount: 33.33 });

    expect(res.status).toBe(201);
    const recipients = res.body.data.recipients;
    const totalPayouts = recipients.reduce((acc: number, r: any) => acc + r.actual_amount, 0);

    // Exact sum match within float precision
    expect(Math.abs(totalPayouts - 33.33)).toBeLessThan(0.00001);
  });

  it('reconciles settlement against blockchain records', async () => {
    const listRes = await request(app).get('/api/settlements?track_id=track-1');
    expect(listRes.status).toBe(200);
    expect(listRes.body.count).toBeGreaterThan(0);

    const settlementId = listRes.body.data[0].id;
    const recRes = await request(app).get(`/api/settlements/reconcile/${settlementId}`);

    expect(recRes.status).toBe(200);
    expect(recRes.body.data.is_reconciled).toBe(true);
    expect(recRes.body.data.discrepancy).toBeLessThan(0.0001);
  });

  it('populates contributor earnings dashboard with settled and pending amounts', async () => {
    const res = await request(app).get(`/api/earnings/contributor/${producerWallet}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.settled_revenue).toBeGreaterThan(0);
    expect(res.body.data.tracks.length).toBeGreaterThan(0);
  });

  it('populates artist revenue dashboard with track-level financial lifecycle', async () => {
    const res = await request(app).get(`/api/earnings/artist/${artistWallet}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tracks.length).toBeGreaterThan(0);
  });
});
