import { describe, it, expect } from 'vitest';

export const STROOPS_PER_XLM = 10_000_000;

export interface ContributorBasis {
  id: string;
  share_basis_points: number; // 10000 = 100%
}

export function distributeStroops(
  grossAmountXlm: number,
  contributors: ContributorBasis[]
): { recipientStroops: number[]; totalAllocatedStroops: number; grossStroops: number } {
  const grossStroops = Math.round(grossAmountXlm * STROOPS_PER_XLM);
  let allocatedStroops = 0;

  const recipientStroops = contributors.map((c) => {
    const share = Math.floor((grossStroops * c.share_basis_points) / 10000);
    allocatedStroops += share;
    return share;
  });

  const remainder = grossStroops - allocatedStroops;
  if (remainder > 0 && recipientStroops.length > 0) {
    recipientStroops[0] += remainder;
    allocatedStroops += remainder;
  }

  return {
    recipientStroops,
    totalAllocatedStroops: allocatedStroops,
    grossStroops,
  };
}

describe('Level 1 Financial Integrity: 0-Stroop Loss Invariant Suite', () => {
  it('proves zero-stroop precision loss over 10,000 randomized split simulations', () => {
    const ITERATIONS = 10_000;

    for (let i = 0; i < ITERATIONS; i++) {
      // Generate random gross amount between 0.0000001 (1 stroop) and 100,000 XLM
      const randomXlm = Number((Math.random() * 50_000 + 0.000001).toFixed(7));
      const grossStroopsExpected = Math.round(randomXlm * STROOPS_PER_XLM);

      // Generate 2 to 8 random contributors summing strictly to 10,000 basis points
      const numContributors = Math.floor(Math.random() * 7) + 2;
      const rawCuts: number[] = [];
      let currentTotal = 0;

      for (let c = 0; c < numContributors - 1; c++) {
        const remainingBp = 10000 - currentTotal - (numContributors - c);
        const cut = Math.max(1, Math.floor(Math.random() * Math.min(4000, remainingBp)));
        rawCuts.push(cut);
        currentTotal += cut;
      }
      rawCuts.push(10000 - currentTotal);

      const contributors: ContributorBasis[] = rawCuts.map((bp, idx) => ({
        id: `contributor-${idx}`,
        share_basis_points: bp,
      }));

      const result = distributeStroops(randomXlm, contributors);

      // Invariant 1: Sum of allocated stroops MUST exactly equal input gross stroops
      const actualSum = result.recipientStroops.reduce((acc, val) => acc + val, 0);
      expect(actualSum).toBe(grossStroopsExpected);
      expect(result.totalAllocatedStroops).toBe(grossStroopsExpected);

      // Invariant 2: No contributor receives negative stroops
      for (const share of result.recipientStroops) {
        expect(share).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('guarantees exact stroop conservation for uneven thirds (33.33%, 33.33%, 33.34%)', () => {
    const contributors: ContributorBasis[] = [
      { id: 'artist-1', share_basis_points: 3334 },
      { id: 'artist-2', share_basis_points: 3333 },
      { id: 'artist-3', share_basis_points: 3333 },
    ];

    // Odd stroop amounts
    const testCases = [0.0000001, 1.0, 7.7777777, 100.3333333, 99999.9999999];

    for (const amount of testCases) {
      const grossStroops = Math.round(amount * STROOPS_PER_XLM);
      const result = distributeStroops(amount, contributors);
      const sum = result.recipientStroops.reduce((a, b) => a + b, 0);

      expect(sum).toBe(grossStroops);
      expect(result.totalAllocatedStroops).toBe(grossStroops);
    }
  });

  it('handles minimum granularity edge case (1 stroop across 5 co-writers)', () => {
    const contributors: ContributorBasis[] = [
      { id: 'c1', share_basis_points: 2000 },
      { id: 'c2', share_basis_points: 2000 },
      { id: 'c3', share_basis_points: 2000 },
      { id: 'c4', share_basis_points: 2000 },
      { id: 'c5', share_basis_points: 2000 },
    ];

    const result = distributeStroops(0.0000001, contributors); // 1 stroop
    expect(result.grossStroops).toBe(1);
    expect(result.totalAllocatedStroops).toBe(1);
    // Dust is safely absorbed by primary contributor (index 0)
    expect(result.recipientStroops[0]).toBe(1);
    expect(result.recipientStroops[1]).toBe(0);
  });
});
