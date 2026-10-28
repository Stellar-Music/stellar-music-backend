import { describe, it, expect } from 'vitest';
import { CreateTrackSchema } from '../src/validators/track.schema.js';
import { CreateSplitSchema } from '../src/validators/split.schema.js';
import { ExecuteSettlementSchema } from '../src/validators/settlement.schema.js';

describe('Zod Schema Validators Tests', () => {
  const validWallet1 = 'GCMMDSL3RW5SHGAXEOW6G5M7KZ2CFWUPUKV5Q5L2NBTUA6F4RK45NE7F';
  const validWallet2 = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

  describe('CreateTrackSchema', () => {
    it('validates a valid track payload', () => {
      const parsed = CreateTrackSchema.safeParse({
        title: 'Stellar Soundscape',
        artist_id: 'artist-1',
        price: 5.0,
        genre: 'Ambient',
      });
      expect(parsed.success).toBe(true);
    });

    it('rejects missing title or negative price', () => {
      expect(CreateTrackSchema.safeParse({ title: '', artist_id: 'a1' }).success).toBe(false);
      expect(CreateTrackSchema.safeParse({ title: 'Song', artist_id: 'a1', price: -1 }).success).toBe(false);
    });
  });

  describe('CreateSplitSchema', () => {
    it('validates split summing to exactly 10,000 basis points', () => {
      const parsed = CreateSplitSchema.safeParse({
        track_id: 'track-1',
        recipients: [
          { recipient: validWallet1, role: 'artist', share_basis_points: 6000 },
          { recipient: validWallet2, role: 'producer', share_basis_points: 4000 },
        ],
      });
      expect(parsed.success).toBe(true);
    });

    it('rejects basis points not totaling 10,000', () => {
      const parsed = CreateSplitSchema.safeParse({
        track_id: 'track-1',
        recipients: [
          { recipient: validWallet1, role: 'artist', share_basis_points: 5000 },
          { recipient: validWallet2, role: 'producer', share_basis_points: 4000 },
        ],
      });
      expect(parsed.success).toBe(false);
    });

    it('rejects duplicate recipient addresses', () => {
      const parsed = CreateSplitSchema.safeParse({
        track_id: 'track-1',
        recipients: [
          { recipient: validWallet1, role: 'artist', share_basis_points: 5000 },
          { recipient: validWallet1, role: 'producer', share_basis_points: 5000 },
        ],
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe('ExecuteSettlementSchema', () => {
    it('validates positive integer gross amount', () => {
      const parsed = ExecuteSettlementSchema.safeParse({
        track_id: 'track-1',
        gross_amount: 10000000,
      });
      expect(parsed.success).toBe(true);
    });

    it('rejects zero or negative gross amount', () => {
      expect(ExecuteSettlementSchema.safeParse({ track_id: 't1', gross_amount: 0 }).success).toBe(false);
      expect(ExecuteSettlementSchema.safeParse({ track_id: 't1', gross_amount: -500 }).success).toBe(false);
    });
  });
});
