import { z } from 'zod';

export const ExecuteSettlementSchema = z.object({
  track_id: z.string().min(1, 'Track ID is required'),
  gross_amount: z.number().int().positive('Gross settlement amount in stroops must be positive'),
  tx_hash: z.string().regex(/^[0-9a-fA-F]{64}$/, 'Must be a 64-character hexadecimal transaction hash').optional(),
});

export type ExecuteSettlementInput = z.infer<typeof ExecuteSettlementSchema>;
