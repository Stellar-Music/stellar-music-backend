import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';
import { getDb } from '../db/database.js';
import {
  RevenuePool,
  Settlement,
  SettlementRecipient,
  ContributorEarningsSummary,
  ArtistRevenueSummary,
} from '../db/schema.js';
import { splitService } from './split.service.js';
import { trackService } from './track.service.js';

type RealtimeListener = (event: any) => void;

export class SettlementService {
  private listeners: Set<RealtimeListener> = new Set();

  /**
   * Subscribe to realtime settlement and revenue events (Server-Sent Events)
   */
  subscribe(listener: RealtimeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private broadcast(event: any) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('SSE Broadcast error:', err);
      }
    }
  }

  /**
   * Record verified incoming payment (e.g. Music Pass) into an active Revenue Pool
   */
  async recordRevenueToPool(
    amount: number,
    asset: string = 'XLM',
    sourceTxHash: string | null = null,
    sourceType: string = 'MUSIC_PASS'
  ): Promise<RevenuePool> {
    const db = await getDb();
    const cleanAsset = (asset || 'XLM').toUpperCase();

    // Check for an open pool for this asset
    let pool = await db.queryOne<RevenuePool>(
      "SELECT * FROM revenue_pools WHERE asset = $1 AND status = 'OPEN' ORDER BY created_at DESC LIMIT 1",
      [cleanAsset]
    );

    const now = new Date().toISOString();

    if (!pool) {
      const poolId = uuidv4();
      await db.execute(
        `INSERT INTO revenue_pools (id, asset, total_amount, allocated_amount, unallocated_amount, source_type, source_tx_hash, status, created_at)
         VALUES ($1, $2, $3, 0, $4, $5, $6, 'OPEN', $7)`,
        [poolId, cleanAsset, amount, amount, sourceType, sourceTxHash, now]
      );
      pool = (await db.queryOne<RevenuePool>('SELECT * FROM revenue_pools WHERE id = $1', [poolId]))!;
    } else {
      const newTotal = pool.total_amount + amount;
      const newUnallocated = pool.unallocated_amount + amount;
      await db.execute(
        `UPDATE revenue_pools
         SET total_amount = $1, unallocated_amount = $2, source_tx_hash = $3
         WHERE id = $4`,
        [newTotal, newUnallocated, sourceTxHash || pool.source_tx_hash, pool.id]
      );
      pool = (await db.queryOne<RevenuePool>('SELECT * FROM revenue_pools WHERE id = $1', [pool.id]))!;
    }

    this.broadcast({
      type: 'REVENUE_RECORDED',
      pool_id: pool.id,
      amount,
      asset: cleanAsset,
      source_tx_hash: sourceTxHash,
      timestamp: now,
    });

    return pool;
  }

  /**
   * List all revenue pools with unallocated balances
   */
  async getRevenuePools(): Promise<RevenuePool[]> {
    const db = await getDb();
    return await db.query<RevenuePool>('SELECT * FROM revenue_pools ORDER BY created_at DESC');
  }

  /**
   * Execute automated multi-recipient settlement for a track based on its active LOCKED split agreement
   */
  async executeTrackSettlement(
    trackId: string,
    grossAmount: number,
    poolId?: string
  ): Promise<{ settlement: Settlement; recipients: SettlementRecipient[] }> {
    const db = await getDb();

    if (grossAmount <= 0) {
      throw new Error('INVALID_AMOUNT: Settlement amount must be greater than zero.');
    }

    // 1. Retrieve the active LOCKED split agreement (authoritative source of truth)
    const lockedSplit = await splitService.getActiveLockedSplit(trackId);
    if (!lockedSplit) {
      throw new Error(
        `NO_LOCKED_AGREEMENT: Track ${trackId} does not have an active LOCKED revenue split agreement. Level 2 agreement must be locked before settlement.`
      );
    }

    const { agreement, contributors } = lockedSplit;
    if (agreement.status !== 'LOCKED') {
      throw new Error('AGREEMENT_NOT_LOCKED: Agreement must be in LOCKED state.');
    }

    // 2. Integer-precise financial calculations using Stroops (1 XLM = 10,000,000 stroops)
    const STROOPS_PER_XLM = 10_000_000;
    const grossStroops = Math.round(grossAmount * STROOPS_PER_XLM);

    let allocatedStroops = 0;
    const calculatedRecipients = contributors.map((c) => {
      const shareStroops = Math.floor((grossStroops * c.share_basis_points) / 10000);
      allocatedStroops += shareStroops;
      return {
        contributor: c,
        stroops: shareStroops,
      };
    });

    // Remainder allocation: ensure exact sum invariant by assigning fractional dust to primary artist (index 0)
    const remainderStroops = grossStroops - allocatedStroops;
    if (remainderStroops > 0 && calculatedRecipients.length > 0) {
      calculatedRecipients[0].stroops += remainderStroops;
    }

    // 3. Generate deterministic settlement ID & mock/real Stellar transaction hash
    const settlementId = uuidv4();
    const now = new Date().toISOString();

    const txHashPayload = `${settlementId}:${agreement.id}:${agreement.agreement_hash}:${grossAmount}:${now}`;
    const txHash = crypto.createHash('sha256').update(txHashPayload).digest('hex');

    // 4. Record settlement entity
    await db.execute(
      `INSERT INTO settlements (id, pool_id, track_id, agreement_id, agreement_version, agreement_hash, asset, gross_amount, status, tx_hash, settled_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'XLM', $7, 'SETTLED', $8, $9, $10)`,
      [
        settlementId,
        poolId || null,
        trackId,
        agreement.id,
        agreement.version,
        agreement.agreement_hash,
        grossAmount,
        txHash,
        now,
        now,
      ]
    );

    // 5. Record individual recipient payout records
    const insertedRecipients: SettlementRecipient[] = [];
    for (const r of calculatedRecipients) {
      const recId = uuidv4();
      const amountXlm = r.stroops / STROOPS_PER_XLM;

      await db.execute(
        `INSERT INTO settlement_recipients (id, settlement_id, wallet_address, contributor_id, role, percentage, share_basis_points, expected_amount, actual_amount, status, tx_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'SETTLED', $10)`,
        [
          recId,
          settlementId,
          r.contributor.wallet_address,
          r.contributor.id,
          r.contributor.role,
          r.contributor.percentage,
          r.contributor.share_basis_points,
          amountXlm,
          amountXlm,
          txHash,
        ]
      );

      insertedRecipients.push({
        id: recId,
        settlement_id: settlementId,
        wallet_address: r.contributor.wallet_address,
        contributor_id: r.contributor.id,
        role: r.contributor.role,
        percentage: r.contributor.percentage,
        share_basis_points: r.contributor.share_basis_points,
        expected_amount: amountXlm,
        actual_amount: amountXlm,
        status: 'SETTLED',
        tx_hash: txHash,
      });
    }

    // 6. Update revenue pool balances if poolId was specified
    if (poolId) {
      const pool = await db.queryOne<RevenuePool>('SELECT * FROM revenue_pools WHERE id = $1', [poolId]);
      if (pool) {
        const newAllocated = pool.allocated_amount + grossAmount;
        const newUnallocated = Math.max(0, pool.unallocated_amount - grossAmount);
        const newStatus = newUnallocated <= 0.0001 ? 'SETTLED' : 'ALLOCATED';

        await db.execute(
          'UPDATE revenue_pools SET allocated_amount = $1, unallocated_amount = $2, status = $3 WHERE id = $4',
          [newAllocated, newUnallocated, newStatus, poolId]
        );
      }
    }

    const createdSettlement = (await db.queryOne<Settlement>(
      'SELECT * FROM settlements WHERE id = $1',
      [settlementId]
    ))!;

    // 7. Emit realtime event for connected dashboards
    this.broadcast({
      type: 'SETTLEMENT_EXECUTED',
      settlement: createdSettlement,
      recipients: insertedRecipients,
      timestamp: now,
    });

    return { settlement: createdSettlement, recipients: insertedRecipients };
  }

  /**
   * Execute an automated settlement run across all tracks with unallocated revenue pools
   */
  async runAutomatedSettlementCycle(): Promise<{
    settlements_executed: number;
    total_settled_xlm: number;
    results: any[];
  }> {
    const db = await getDb();

    // Find tracks that have published music passes
    const tracksWithRevenue = await db.query<{ track_id: string; total_rev: number }>(`
      SELECT track_id, SUM(payment_amount) as total_rev
      FROM music_passes
      WHERE status = 'CONFIRMED'
      GROUP BY track_id
    `);

    let settlementsExecuted = 0;
    let totalSettled = 0;
    const results = [];

    for (const item of tracksWithRevenue) {
      // Check already settled amount for track
      const settledRow = await db.queryOne<{ settled_rev: number }>(`
        SELECT COALESCE(SUM(gross_amount), 0) as settled_rev
        FROM settlements
        WHERE track_id = $1 AND status = 'SETTLED'
      `, [item.track_id]);

      const alreadySettled = settledRow ? settledRow.settled_rev : 0;
      const pendingToSettle = Math.max(0, item.total_rev - alreadySettled);

      if (pendingToSettle >= 0.01) {
        try {
          const res = await this.executeTrackSettlement(item.track_id, pendingToSettle);
          settlementsExecuted++;
          totalSettled += pendingToSettle;
          results.push({
            track_id: item.track_id,
            amount: pendingToSettle,
            settlement_id: res.settlement.id,
            status: 'SUCCESS',
          });
        } catch (err: any) {
          results.push({
            track_id: item.track_id,
            amount: pendingToSettle,
            status: 'SKIPPED',
            reason: err.message,
          });
        }
      }
    }

    return {
      settlements_executed: settlementsExecuted,
      total_settled_xlm: totalSettled,
      results,
    };
  }

  /**
   * Reconcile a settlement against recorded ledger and transaction details
   */
  async reconcileSettlement(settlementId: string): Promise<{
    settlement_id: string;
    is_reconciled: boolean;
    discrepancy: number;
    expected_gross: number;
    actual_gross: number;
    status: string;
    recipients_verified: number;
  }> {
    const db = await getDb();
    const settlement = await db.queryOne<Settlement>(
      'SELECT * FROM settlements WHERE id = $1',
      [settlementId]
    );

    if (!settlement) throw new Error('Settlement not found.');

    const recipients = await db.query<SettlementRecipient>(
      'SELECT * FROM settlement_recipients WHERE settlement_id = $1',
      [settlementId]
    );

    const actualGross = recipients.reduce((acc, r) => acc + r.actual_amount, 0);
    const discrepancy = Math.abs(settlement.gross_amount - actualGross);
    const isReconciled = discrepancy < 0.0001;

    return {
      settlement_id: settlementId,
      is_reconciled: isReconciled,
      discrepancy,
      expected_gross: settlement.gross_amount,
      actual_gross: actualGross,
      status: settlement.status,
      recipients_verified: recipients.length,
    };
  }

  /**
   * Get contributor earnings summary (Level 3 Dashboard)
   */
  async getContributorEarnings(walletAddress: string): Promise<ContributorEarningsSummary> {
    const db = await getDb();
    const cleanWallet = walletAddress.trim().toUpperCase();

    // Query all settlement payouts for this wallet
    const settledPayouts = await db.query<{
      track_id: string;
      track_title: string;
      role: string;
      percentage: number;
      amount: number;
      tx_hash: string;
    }>(`
      SELECT s.track_id, t.title AS track_title, sr.role, sr.percentage, sr.actual_amount AS amount, s.tx_hash
      FROM settlement_recipients sr
      JOIN settlements s ON sr.settlement_id = s.id
      JOIN tracks t ON s.track_id = t.id
      WHERE UPPER(sr.wallet_address) = $1 AND sr.status = 'SETTLED'
    `, [cleanWallet]);

    // Query tracks where wallet is a contributor in locked agreement
    const contributorTracks = await db.query<{
      track_id: string;
      track_title: string;
      role: string;
      percentage: number;
      total_track_revenue: number;
    }>(`
      SELECT a.track_id, t.title AS track_title, c.role, c.percentage,
             COALESCE((SELECT SUM(payment_amount) FROM music_passes WHERE track_id = a.track_id AND status = 'CONFIRMED'), 0) as total_track_revenue
      FROM split_contributors c
      JOIN split_agreements a ON c.agreement_id = a.id
      JOIN tracks t ON a.track_id = t.id
      WHERE UPPER(c.wallet_address) = $1 AND a.status = 'LOCKED'
    `, [cleanWallet]);

    const trackMap = new Map<string, {
      track_id: string;
      track_title: string;
      role: string;
      percentage: number;
      pending: number;
      settled: number;
      latest_tx_hash: string | null;
    }>();

    for (const ct of contributorTracks) {
      const entitlement = (ct.total_track_revenue * ct.percentage) / 100;
      trackMap.set(ct.track_id, {
        track_id: ct.track_id,
        track_title: ct.track_title,
        role: ct.role,
        percentage: ct.percentage,
        pending: entitlement,
        settled: 0,
        latest_tx_hash: null,
      });
    }

    let totalSettled = 0;
    for (const sp of settledPayouts) {
      totalSettled += sp.amount;
      const existing = trackMap.get(sp.track_id);
      if (existing) {
        existing.settled += sp.amount;
        existing.pending = Math.max(0, existing.pending - sp.amount);
        existing.latest_tx_hash = sp.tx_hash;
      } else {
        trackMap.set(sp.track_id, {
          track_id: sp.track_id,
          track_title: sp.track_title,
          role: sp.role,
          percentage: sp.percentage,
          pending: 0,
          settled: sp.amount,
          latest_tx_hash: sp.tx_hash,
        });
      }
    }

    const tracksList = Array.from(trackMap.values());
    const totalPending = tracksList.reduce((acc, t) => acc + t.pending, 0);

    return {
      wallet_address: walletAddress,
      total_earned: totalSettled + totalPending,
      pending_revenue: totalPending,
      settled_revenue: totalSettled,
      tracks: tracksList,
    };
  }

  /**
   * Get artist revenue overview (Level 3 Artist Dashboard)
   */
  async getArtistRevenue(artistWallet: string): Promise<ArtistRevenueSummary> {
    const db = await getDb();
    const cleanWallet = artistWallet.trim().toUpperCase();

    const artistTracks = await db.query<{
      id: string;
      title: string;
      total_revenue: number;
    }>(`
      SELECT t.id, t.title,
             COALESCE((SELECT SUM(payment_amount) FROM music_passes WHERE track_id = t.id AND status = 'CONFIRMED'), 0) as total_revenue
      FROM tracks t
      JOIN artists a ON t.artist_id = a.id
      WHERE UPPER(a.wallet_address) = $1
    `, [cleanWallet]);

    const tracks = [];
    let grandTotalRevenue = 0;
    let grandTotalSettled = 0;

    for (const at of artistTracks) {
      const activeSplit = await splitService.getActiveLockedSplit(at.id);
      const isLocked = Boolean(activeSplit);
      const version = activeSplit ? activeSplit.agreement.version : 1;

      const settledRow = await db.queryOne<{ settled: number }>(`
        SELECT COALESCE(SUM(gross_amount), 0) as settled
        FROM settlements
        WHERE track_id = $1 AND status = 'SETTLED'
      `, [at.id]);

      const settled = settledRow ? settledRow.settled : 0;
      const pending = Math.max(0, at.total_revenue - settled);

      grandTotalRevenue += at.total_revenue;
      grandTotalSettled += settled;

      tracks.push({
        track_id: at.id,
        track_title: at.title,
        total_revenue: at.total_revenue,
        pending,
        settled,
        agreement_version: version,
        is_locked: isLocked,
      });
    }

    return {
      artist_wallet: artistWallet,
      total_revenue: grandTotalRevenue,
      pending_settlement: Math.max(0, grandTotalRevenue - grandTotalSettled),
      settled_revenue: grandTotalSettled,
      tracks,
    };
  }

  /**
   * Query settlements history with optional track filter
   */
  async getSettlements(trackId?: string): Promise<Settlement[]> {
    const db = await getDb();
    if (trackId) {
      return await db.query<Settlement>(
        'SELECT * FROM settlements WHERE track_id = $1 ORDER BY created_at DESC',
        [trackId]
      );
    }
    return await db.query<Settlement>('SELECT * FROM settlements ORDER BY created_at DESC');
  }

  /**
   * Get single settlement with recipient details
   */
  async getSettlementById(settlementId: string): Promise<{
    settlement: Settlement;
    recipients: SettlementRecipient[];
  } | null> {
    const db = await getDb();
    const settlement = await db.queryOne<Settlement>(
      'SELECT * FROM settlements WHERE id = $1',
      [settlementId]
    );
    if (!settlement) return null;

    const recipients = await db.query<SettlementRecipient>(
      'SELECT * FROM settlement_recipients WHERE settlement_id = $1 ORDER BY actual_amount DESC',
      [settlementId]
    );

    return { settlement, recipients };
  }
}

export const settlementService = new SettlementService();
