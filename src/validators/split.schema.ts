import { z } from 'zod';

export const SplitRecipientSchema = z.object({
  recipient: z.string().regex(/^G[A-Z2-7]{55}$/, 'Must be a valid Stellar public key starting with G'),
  role: z.enum(['artist', 'producer', 'songwrtr', 'engineer', 'curator']),
  share_basis_points: z.number().int().min(1).max(10000),
});

export const CreateSplitSchema = z.object({
  track_id: z.string().min(1, 'Track ID is required'),
  recipients: z.array(SplitRecipientSchema)
    .min(1, 'Must specify at least one recipient')
    .max(25, 'Cannot exceed 25 collaborators')
    .refine(
      (recipients) => {
        const total = recipients.reduce((acc, r) => acc + r.share_basis_points, 0);
        return total === 10000;
      },
      { message: 'Basis points must sum to exactly 10,000 (100.00%)' }
    )
    .refine(
      (recipients) => {
        const unique = new Set(recipients.map((r) => r.recipient));
        return unique.size === recipients.length;
      },
      { message: 'Duplicate recipient addresses are prohibited' }
    ),
});

export type CreateSplitInput = z.infer<typeof CreateSplitSchema>;
