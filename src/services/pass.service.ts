import { getDb } from '../db/database.js';
import { MusicPass } from '../db/schema.js';
import { trackService } from './track.service.js';
import { stellarService } from './stellar.service.js';
import { v4 as uuidv4 } from 'uuid';

export class PassService {
  /**
   * Verifies the on-chain Stellar Testnet payment and records the Music Pass
   */
  async purchasePass(data: {
    track_id: string;
    purchaser_wallet: string;
    transaction_hash: string;
  }): Promise<{ success: boolean; pass?: MusicPass; error?: string }> {
    const db = await getDb();

    // 1. Fetch track information
    const track = await trackService.getTrackById(data.track_id);
    if (!track) {
      return { success: false, error: 'TRACK_NOT_FOUND: Specified track does not exist.' };
    }

    // 2. Check if user already owns a pass for this track
    const existing = await db.queryOne<MusicPass>(
      'SELECT * FROM music_passes WHERE track_id = $1 AND purchaser_wallet = $2',
      [data.track_id, data.purchaser_wallet]
    );
    if (existing) {
      return { success: true, pass: existing };
    }

    // 3. Verify real Stellar Testnet transaction
    const verification = await stellarService.verifyPayment(
      data.transaction_hash,
      data.purchaser_wallet,
      track.artist_wallet,
      track.price
    );

    if (!verification.isValid) {
      return { success: false, error: verification.error };
    }

    // 4. Save Music Pass record
    const passId = uuidv4();
    const purchasedAt = new Date().toISOString();

    await db.execute(
      `INSERT INTO music_passes (id, track_id, purchaser_wallet, payment_amount, transaction_hash, status, purchased_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        passId,
        data.track_id,
        data.purchaser_wallet,
        verification.amount,
        data.transaction_hash,
        'CONFIRMED',
        purchasedAt,
      ]
    );

    const newPass = await this.getPassById(passId);
    return { success: true, pass: newPass || undefined };
  }

  async hasPass(trackId: string, purchaserWallet: string): Promise<boolean> {
    if (!purchaserWallet) return false;
    const db = await getDb();
    const pass = await db.queryOne(
      `SELECT id FROM music_passes 
       WHERE track_id = $1 AND LOWER(purchaser_wallet) = LOWER($2) AND status = 'CONFIRMED'`,
      [trackId, purchaserWallet]
    );
    return !!pass;
  }

  async getPassById(id: string): Promise<MusicPass | null> {
    const db = await getDb();
    return await db.queryOne<MusicPass>('SELECT * FROM music_passes WHERE id = $1', [id]);
  }

  async getPasses(options: {
    wallet?: string;
    trackId?: string;
  } = {}): Promise<MusicPass[]> {
    const db = await getDb();
    let query = 'SELECT * FROM music_passes WHERE 1=1';
    const params: any[] = [];
    let pIndex = 1;

    if (options.wallet) {
      query += ` AND LOWER(purchaser_wallet) = LOWER($${pIndex++})`;
      params.push(options.wallet);
    }
    if (options.trackId) {
      query += ` AND track_id = $${pIndex++}`;
      params.push(options.trackId);
    }

    query += ' ORDER BY purchased_at DESC';
    return await db.query<MusicPass>(query, params);
  }
}

export const passService = new PassService();
