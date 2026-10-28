import { z } from 'zod';

export const CreateTrackSchema = z.object({
  title: z.string().min(1, 'Title is required').max(120, 'Title cannot exceed 120 characters'),
  artist_id: z.string().min(1, 'Artist ID is required'),
  description: z.string().max(1000).optional(),
  price: z.number().min(0, 'Price must be non-negative').default(0),
  genre: z.string().min(1).max(50).default('Electronic'),
  duration: z.number().positive('Duration must be positive').optional(),
});

export type CreateTrackInput = z.infer<typeof CreateTrackSchema>;
