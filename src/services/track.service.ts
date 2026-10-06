import { getDb } from '../db/database.js';
import { Track, TrackStatus } from '../db/schema.js';
import { v4 as uuidv4 } from 'uuid';

export class TrackService {
  async getTracks(options: {
    status?: TrackStatus;
    genre?: string;
    artistId?: string;
    search?: string;
  } = {}): Promise<(Track & { artist_name: string; artist_wallet: string })[]> {
    const db = await getDb();
    let query = `
      SELECT t.*, a.display_name AS artist_name, a.wallet_address AS artist_wallet
      FROM tracks t
      JOIN artists a ON t.artist_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (options.status) {
      query += ` AND t.status = $${paramIndex++}`;
      params.push(options.status);
    }
    if (options.genre) {
      query += ` AND LOWER(t.genre) = LOWER($${paramIndex++})`;
      params.push(options.genre);
    }
    if (options.artistId) {
      query += ` AND t.artist_id = $${paramIndex++}`;
      params.push(options.artistId);
    }
    if (options.search) {
      query += ` AND (LOWER(t.title) LIKE LOWER($${paramIndex++}) OR LOWER(a.display_name) LIKE LOWER($${paramIndex++}))`;
      params.push(`%${options.search}%`);
      params.push(`%${options.search}%`);
    }

    query += ` ORDER BY t.created_at DESC`;

    return await db.query(query, params);
  }

  async getTrackById(id: string): Promise<(Track & { artist_name: string; artist_wallet: string }) | null> {
    const db = await getDb();
    const query = `
      SELECT t.*, a.display_name AS artist_name, a.wallet_address AS artist_wallet
      FROM tracks t
      JOIN artists a ON t.artist_id = a.id
      WHERE t.id = $1
    `;
    return await db.queryOne(query, [id]);
  }

  async createTrack(data: {
    artist_id: string;
    title: string;
    description?: string;
    audio_reference: string;
    artwork_reference: string;
    price: number;
    status?: TrackStatus;
    genre?: string;
    duration_seconds?: number;
  }): Promise<Track> {
    const db = await getDb();
    const trackId = uuidv4();
    const status = data.status || 'DRAFT';
    const duration = data.duration_seconds || 180;
    const createdAt = new Date().toISOString();

    await db.execute(
      `INSERT INTO tracks (id, artist_id, title, description, audio_reference, artwork_reference, price, status, genre, duration_seconds, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        trackId,
        data.artist_id,
        data.title,
        data.description || null,
        data.audio_reference,
        data.artwork_reference,
        data.price,
        status,
        data.genre || null,
        duration,
        createdAt,
      ]
    );

    const track = await this.getTrackById(trackId);
    if (!track) throw new Error('Failed to retrieve newly created track');
    return track;
  }

  async updateTrack(
    id: string,
    updates: Partial<Pick<Track, 'title' | 'description' | 'price' | 'status' | 'genre'>>
  ): Promise<Track | null> {
    const db = await getDb();
    const existing = await this.getTrackById(id);
    if (!existing) return null;

    const newTitle = updates.title ?? existing.title;
    const newDesc = updates.description ?? existing.description;
    const newPrice = updates.price ?? existing.price;
    const newStatus = updates.status ?? existing.status;
    const newGenre = updates.genre ?? existing.genre;

    await db.execute(
      `UPDATE tracks
       SET title = $1, description = $2, price = $3, status = $4, genre = $5
       WHERE id = $6`,
      [newTitle, newDesc, newPrice, newStatus, newGenre, id]
    );

    return await this.getTrackById(id);
  }
}

export const trackService = new TrackService();
