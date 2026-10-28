import { describe, it, expect } from 'vitest';
import { CreateSplitSchema } from '../src/validators/split.schema.js';
import { ExecuteSettlementSchema } from '../src/validators/settlement.schema.js';
import { CreateTrackSchema } from '../src/validators/track.schema.js';

describe('Level 1 & 2: Zod Schema Validation Depth', () => {
  const addr1 = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVWGS';
  const addr2 = 'GBU7M3L62RTR6YXZZ2WOD6W7G3D7JGBWUXR7G7C3T3G2Z7C66Q4U5XYZ';

  describe('CreateSplitSchema', () => {
    it('accepts split contributors summing to 10,000 basis points', () => {
      const valid = {
        track_id: '123e4567-e89b-12d3-a456-426614174000',
        recipients: [
          {
            recipient: addr1,
            role: 'artist',
            share_basis_points: 6000,
          },
          {
            recipient: addr2,
            role: 'producer',
            share_basis_points: 4000,
          },
        ],
      };

      const result = CreateSplitSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects contributors summing to less than 10,000 basis points', () => {
      const invalid = {
        track_id: '123e4567-e89b-12d3-a456-426614174000',
        recipients: [
          {
            recipient: addr1,
            role: 'artist',
            share_basis_points: 5000,
          },
        ],
      };

      const result = CreateSplitSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects duplicate recipient addresses', () => {
      const duplicate = {
        track_id: '123e4567-e89b-12d3-a456-426614174000',
        recipients: [
          {
            recipient: addr1,
            role: 'artist',
            share_basis_points: 5000,
          },
          {
            recipient: addr1,
            role: 'producer',
            share_basis_points: 5000,
          },
        ],
      };

      const result = CreateSplitSchema.safeParse(duplicate);
      expect(result.success).toBe(false);
    });
  });

  describe('ExecuteSettlementSchema', () => {
    it('validates positive settlement amount in stroops', () => {
      const result = ExecuteSettlementSchema.safeParse({
        track_id: 'track-1',
        gross_amount: 10_000_000,
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-positive settlement amount', () => {
      const result = ExecuteSettlementSchema.safeParse({
        track_id: 'track-1',
        gross_amount: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('CreateTrackSchema', () => {
    it('rejects negative pass prices', () => {
      const result = CreateTrackSchema.safeParse({
        title: 'New Track',
        artist_id: 'art-1',
        price: -5,
      });
      expect(result.success).toBe(false);
    });
  });
});
