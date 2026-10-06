import crypto from 'node:crypto';
import { getDb } from '../db/database.js';
import {
  SplitAgreement,
  SplitContributor,
  SplitSignature,
  AgreementEvent,
  SplitAgreementStatus,
} from '../db/schema.js';
import { trackService } from './track.service.js';
import { v4 as uuidv4 } from 'uuid';

export interface ContributorInput {
  wallet_address: string;
  display_name: string;
  role: string;
  percentage: number; // e.g. 50.0
}

export class SplitService {
  /**
   * Generates a deterministic SHA-256 agreement hash from canonical terms
   */
  computeAgreementHash(
    trackId: string,
    version: number,
    contributors: { wallet_address: string; role: string; share_basis_points: number }[]
  ): string {
    // Sort contributors deterministically by wallet address
    const sorted = [...contributors].sort((a, b) =>
      a.wallet_address.toLowerCase().localeCompare(b.wallet_address.toLowerCase())
    );

    const canonicalTerms = {
      domain: 'StellarMusic::RevenueSplitAgreement',
      network: 'TESTNET',
      track_id: trackId,
      version,
      contributors: sorted.map((c) => ({
        wallet: c.wallet_address.toUpperCase(),
        role: c.role.toLowerCase(),
        basis_points: c.share_basis_points,
      })),
    };

    const canonicalString = JSON.stringify(canonicalTerms);
    return crypto.createHash('sha256').update(canonicalString).digest('hex');
  }

  /**
   * Validate Stellar public key format
   */
  isValidStellarAddress(address: string): boolean {
    return typeof address === 'string' && address.startsWith('G') && address.length >= 24;
  }

  /**
   * Create a new revenue split agreement
   */
  async createAgreement(
    trackId: string,
    createdByWallet: string,
    contributors: ContributorInput[]
  ): Promise<{ agreement: SplitAgreement; contributors: SplitContributor[] }> {
    const db = await getDb();

    // 1. Verify track
    const track = await trackService.getTrackById(trackId);
    if (!track) {
      throw new Error('TRACK_NOT_FOUND: Track does not exist.');
    }

    // 2. Validate input contributors
    if (!contributors || contributors.length === 0) {
      throw new Error('NO_CONTRIBUTORS: At least one contributor is required.');
    }

    let totalPercentage = 0;
    const seenWallets = new Set<string>();

    const normalizedContributors = contributors.map((c) => {
      const wallet = c.wallet_address.trim();
      const role = c.role.trim();
      const name = (c.display_name || 'Contributor').trim();
      const pct = parseFloat(c.percentage.toString());

      if (!wallet) throw new Error('INVALID_WALLET: Contributor wallet address is required.');
      if (!this.isValidStellarAddress(wallet)) {
        throw new Error(`INVALID_STELLAR_ADDRESS: Address ${wallet} is not a valid Stellar public key.`);
      }
      if (seenWallets.has(wallet.toUpperCase())) {
        throw new Error(`DUPLICATE_CONTRIBUTOR: Wallet ${wallet} is listed more than once.`);
      }
      seenWallets.add(wallet.toUpperCase());

      if (isNaN(pct) || pct <= 0) {
        throw new Error(`INVALID_PERCENTAGE: Allocation for ${name} must be greater than 0%.`);
      }
      totalPercentage += pct;

      // Basis points: 50.0% -> 5000 bps
      const bps = Math.round(pct * 100);
      return {
        wallet_address: wallet,
        display_name: name,
        role,
        percentage: pct,
        share_basis_points: bps,
      };
    });

    // 3. Strict 100% check (tolerance 0.001 for floating point)
    if (Math.abs(totalPercentage - 100.0) > 0.001) {
      throw new Error(`INVALID_TOTAL: Split allocation must total exactly 100.0%. Current total: ${totalPercentage.toFixed(2)}%.`);
    }

    // 4. Calculate version number
    const prevVersions = await db.query<SplitAgreement>(
      'SELECT version, status FROM split_agreements WHERE track_id = $1 ORDER BY version DESC',
      [trackId]
    );

    let nextVersion = 1;
    if (prevVersions.length > 0) {
      nextVersion = prevVersions[0].version + 1;
      // Mark prior un-locked draft as SUPERSEDED
      for (const prev of prevVersions) {
        if (prev.status === 'DRAFT' || prev.status === 'AWAITING_SIGNATURES') {
          await db.execute(
            "UPDATE split_agreements SET status = 'SUPERSEDED' WHERE track_id = $1 AND version = $2",
            [trackId, prev.version]
          );
        }
      }
    }

    // 5. Generate deterministic agreement hash
    const agreementHash = this.computeAgreementHash(
      trackId,
      nextVersion,
      normalizedContributors.map((c) => ({
        wallet_address: c.wallet_address,
        role: c.role,
        share_basis_points: c.share_basis_points,
      }))
    );

    // 6. Insert agreement
    const agreementId = uuidv4();
    const now = new Date().toISOString();

    await db.execute(
      `INSERT INTO split_agreements (id, track_id, version, status, agreement_hash, created_by, created_at)
       VALUES ($1, $2, $3, 'AWAITING_SIGNATURES', $4, $5, $6)`,
      [agreementId, trackId, nextVersion, agreementHash, createdByWallet, now]
    );

    // 7. Insert contributors & auto-approve creator if listed
    const insertedContributors: SplitContributor[] = [];
    let allSigned = true;

    for (const c of normalizedContributors) {
      const contribId = uuidv4();
      const isCreator = c.wallet_address.toUpperCase() === createdByWallet.toUpperCase();
      const hasSigned = isCreator ? 1 : 0;
      const signedAt = isCreator ? now : null;

      if (!isCreator) {
        allSigned = false;
      }

      await db.execute(
        `INSERT INTO split_contributors (id, agreement_id, wallet_address, display_name, role, percentage, share_basis_points, has_signed, signed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [contribId, agreementId, c.wallet_address, c.display_name, c.role, c.percentage, c.share_basis_points, hasSigned, signedAt]
      );

      if (isCreator) {
        await db.execute(
          `INSERT INTO split_signatures (id, agreement_id, contributor_id, wallet_address, signature_hash, signed_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [uuidv4(), agreementId, contribId, c.wallet_address, agreementHash, now]
        );
      }

      insertedContributors.push({
        id: contribId,
        agreement_id: agreementId,
        wallet_address: c.wallet_address,
        display_name: c.display_name,
        role: c.role,
        percentage: c.percentage,
        share_basis_points: c.share_basis_points,
        has_signed: !!hasSigned,
        signed_at: signedAt,
        signature_ref: null,
      });
    }

    // 8. Auto-lock if single creator contributor
    if (allSigned) {
      await db.execute(
        "UPDATE split_agreements SET status = 'LOCKED', locked_at = $1 WHERE id = $2",
        [now, agreementId]
      );
      await this.recordEvent(agreementId, 'LOCKED', createdByWallet, 'All contributors signed; agreement locked.');
    } else {
      await this.recordEvent(
        agreementId,
        'CREATED',
        createdByWallet,
        `Agreement v${nextVersion} created with ${normalizedContributors.length} contributors.`
      );
    }

    const createdAgreement = (await this.getAgreementById(agreementId))?.agreement;
    return { agreement: createdAgreement!, contributors: insertedContributors };
  }

  /**
   * Fetch complete agreement details with contributors, signatures, and events
   */
  async getAgreementById(id: string): Promise<{
    agreement: SplitAgreement;
    contributors: SplitContributor[];
    signatures: SplitSignature[];
    events: AgreementEvent[];
  } | null> {
    const db = await getDb();
    const agreement = await db.queryOne<SplitAgreement>(
      'SELECT * FROM split_agreements WHERE id = $1',
      [id]
    );
    if (!agreement) return null;

    const contributors = await db.query<SplitContributor>(
      'SELECT * FROM split_contributors WHERE agreement_id = $1 ORDER BY percentage DESC',
      [id]
    );

    const signatures = await db.query<SplitSignature>(
      'SELECT * FROM split_signatures WHERE agreement_id = $1 ORDER BY signed_at ASC',
      [id]
    );

    const events = await db.query<AgreementEvent>(
      'SELECT * FROM agreement_events WHERE agreement_id = $1 ORDER BY created_at ASC',
      [id]
    );

    return {
      agreement,
      contributors: contributors.map((c) => ({ ...c, has_signed: Boolean(c.has_signed) })),
      signatures,
      events,
    };
  }

  /**
   * Fetch all agreements for a track
   */
  async getAgreementsByTrack(trackId: string): Promise<SplitAgreement[]> {
    const db = await getDb();
    return await db.query<SplitAgreement>(
      'SELECT * FROM split_agreements WHERE track_id = $1 ORDER BY version DESC',
      [trackId]
    );
  }

  /**
   * Get active locked split for a track (for Level 3 settlement!)
   */
  async getActiveLockedSplit(trackId: string): Promise<{
    agreement: SplitAgreement;
    contributors: SplitContributor[];
  } | null> {
    const db = await getDb();
    const agreement = await db.queryOne<SplitAgreement>(
      "SELECT * FROM split_agreements WHERE track_id = $1 AND status = 'LOCKED' ORDER BY version DESC LIMIT 1",
      [trackId]
    );
    if (!agreement) return null;

    const contributors = await db.query<SplitContributor>(
      'SELECT * FROM split_contributors WHERE agreement_id = $1 ORDER BY percentage DESC',
      [agreement.id]
    );

    return {
      agreement,
      contributors: contributors.map((c) => ({ ...c, has_signed: Boolean(c.has_signed) })),
    };
  }

  /**
   * Contributor signs/approves an agreement
   */
  async signAgreement(
    agreementId: string,
    signerWallet: string,
    signatureRef?: string
  ): Promise<{ agreement: SplitAgreement; isLocked: boolean }> {
    const db = await getDb();

    const data = await this.getAgreementById(agreementId);
    if (!data) throw new Error('AGREEMENT_NOT_FOUND');

    const { agreement, contributors } = data;

    if (agreement.status === 'LOCKED') {
      throw new Error('AGREEMENT_LOCKED: Cannot modify an already locked agreement.');
    }
    if (agreement.status === 'SUPERSEDED' || agreement.status === 'REJECTED') {
      throw new Error(`INVALID_STATUS: Agreement is ${agreement.status}.`);
    }

    // Find contributor
    const contrib = contributors.find(
      (c) => c.wallet_address.toUpperCase() === signerWallet.toUpperCase()
    );
    if (!contrib) {
      throw new Error(`NOT_A_CONTRIBUTOR: Wallet ${signerWallet} is not part of this agreement.`);
    }

    if (contrib.has_signed) {
      return { agreement, isLocked: false };
    }

    const now = new Date().toISOString();

    // Record signature
    await db.execute(
      `UPDATE split_contributors
       SET has_signed = 1, signed_at = $1, signature_ref = $2
       WHERE id = $3`,
      [now, signatureRef || null, contrib.id]
    );

    await db.execute(
      `INSERT INTO split_signatures (id, agreement_id, contributor_id, wallet_address, signature_hash, signed_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuidv4(), agreementId, contrib.id, signerWallet, agreement.agreement_hash, now]
    );

    await this.recordEvent(
      agreementId,
      'SIGNED',
      signerWallet,
      `Contributor ${contrib.display_name} (${contrib.role}) signed agreement.`
    );

    // Check if all contributors have signed
    const updatedContributors = await db.query<SplitContributor>(
      'SELECT has_signed FROM split_contributors WHERE agreement_id = $1',
      [agreementId]
    );

    const allSigned = updatedContributors.every((c) => Boolean(c.has_signed));
    let newStatus: SplitAgreementStatus = allSigned ? 'LOCKED' : 'PARTIALLY_SIGNED';
    let lockedAt = allSigned ? now : null;

    await db.execute(
      'UPDATE split_agreements SET status = $1, locked_at = $2 WHERE id = $3',
      [newStatus, lockedAt, agreementId]
    );

    if (allSigned) {
      await this.recordEvent(
        agreementId,
        'LOCKED',
        signerWallet,
        'All required contributors signed. Agreement is now LOCKED and immutable.'
      );
    }

    const updated = (await this.getAgreementById(agreementId))?.agreement!;
    return { agreement: updated, isLocked: allSigned };
  }

  /**
   * Contributor rejects an agreement
   */
  async rejectAgreement(
    agreementId: string,
    rejecterWallet: string,
    reason?: string
  ): Promise<SplitAgreement> {
    const db = await getDb();
    const data = await this.getAgreementById(agreementId);
    if (!data) throw new Error('AGREEMENT_NOT_FOUND');

    if (data.agreement.status === 'LOCKED') {
      throw new Error('AGREEMENT_LOCKED: Cannot reject a locked agreement.');
    }

    await db.execute(
      "UPDATE split_agreements SET status = 'REJECTED' WHERE id = $1",
      [agreementId]
    );

    await this.recordEvent(
      agreementId,
      'REJECTED',
      rejecterWallet,
      `Rejected by ${rejecterWallet}: ${reason || 'Terms rejected'}`
    );

    return (await this.getAgreementById(agreementId))?.agreement!;
  }

  /**
   * Query all agreements involving a wallet (for Contributor Dashboard)
   */
  async getSplitsForWallet(walletAddress: string): Promise<{
    awaiting_my_signature: any[];
    awaiting_others: any[];
    locked: any[];
    other: any[];
  }> {
    const db = await getDb();
    const cleanWallet = walletAddress.trim().toUpperCase();

    const query = `
      SELECT a.*, c.role, c.percentage, c.share_basis_points, c.has_signed, c.signed_at,
             t.title AS track_title, t.artwork_reference AS track_artwork
      FROM split_contributors c
      JOIN split_agreements a ON c.agreement_id = a.id
      JOIN tracks t ON a.track_id = t.id
      WHERE UPPER(c.wallet_address) = $1
      ORDER BY a.created_at DESC
    `;

    const rows = await db.query(query, [cleanWallet]);

    const awaiting_my_signature: any[] = [];
    const awaiting_others: any[] = [];
    const locked: any[] = [];
    const other: any[] = [];

    for (const r of rows) {
      const hasSigned = Boolean(r.has_signed);
      if (r.status === 'LOCKED') {
        locked.push(r);
      } else if (r.status === 'AWAITING_SIGNATURES' || r.status === 'PARTIALLY_SIGNED') {
        if (!hasSigned) {
          awaiting_my_signature.push(r);
        } else {
          awaiting_others.push(r);
        }
      } else {
        other.push(r);
      }
    }

    return { awaiting_my_signature, awaiting_others, locked, other };
  }

  /**
   * Helper: audit log recorder
   */
  async recordEvent(
    agreementId: string,
    eventType: AgreementEvent['event_type'],
    performedBy: string,
    details: string
  ): Promise<void> {
    const db = await getDb();
    await db.execute(
      `INSERT INTO agreement_events (id, agreement_id, event_type, performed_by, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuidv4(), agreementId, eventType, performedBy, details, new Date().toISOString()]
    );
  }
}

export const splitService = new SplitService();
