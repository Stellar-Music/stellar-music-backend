import { Router, Request, Response } from 'express';
import { getDb } from '../db/database.js';
import { Artist } from '../db/schema.js';
import { v4 as uuidv4 } from 'uuid';

export const artistRouter = Router();

/**
 * GET /api/artists
 * List registered artists
 */
artistRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const artists = await db.query<Artist>('SELECT * FROM artists ORDER BY created_at DESC');
    res.json({ success: true, count: artists.length, data: artists });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/artists/:id
 * Fetch artist by ID or wallet address
 */
artistRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const artist = await db.queryOne<Artist>(
      'SELECT * FROM artists WHERE id = $1 OR wallet_address = $1',
      [req.params.id]
    );
    if (!artist) {
      return res.status(404).json({ success: false, error: 'Artist not found' });
    }
    res.json({ success: true, data: artist });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/artists
 * Register a new artist profile
 */
artistRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { wallet_address, display_name, bio } = req.body;
    if (!wallet_address || !display_name) {
      return res.status(400).json({
        success: false,
        error: 'wallet_address and display_name are required.',
      });
    }

    const db = await getDb();
    const existing = await db.queryOne<Artist>(
      'SELECT * FROM artists WHERE wallet_address = $1',
      [wallet_address]
    );
    if (existing) {
      return res.json({ success: true, data: existing });
    }

    const id = uuidv4();
    const createdAt = new Date().toISOString();
    await db.execute(
      `INSERT INTO artists (id, wallet_address, display_name, bio, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, wallet_address, display_name, bio || null, createdAt]
    );

    // Also ensure user record exists
    await db.execute(
      `INSERT INTO users (id, wallet_address, role, created_at)
       VALUES ($1, $2, 'ARTIST', $3)
       ON CONFLICT (wallet_address) DO NOTHING`,
      [uuidv4(), wallet_address, createdAt]
    );

    const artist = await db.queryOne<Artist>('SELECT * FROM artists WHERE id = $1', [id]);
    res.status(201).json({ success: true, data: artist });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
