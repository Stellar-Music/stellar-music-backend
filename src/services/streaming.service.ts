import { getDb } from '../db/database.js';
import { StreamingSession, Track } from '../db/schema.js';
import { trackService } from './track.service.js';
import { passService } from './pass.service.js';
import { v4 as uuidv4 } from 'uuid';

export interface AccessCheckResult {
  hasAccess: boolean;
  reason?: 'FREE_TRACK' | 'PASS_CONFIRMED' | 'PASS_REQUIRED' | 'TRACK_NOT_FOUND' | 'TRACK_INACTIVE';
  price: number;
  track?: Track;
}

export class StreamingService {
  /**
   * Determine whether a listener has legitimate access to stream a given track
   */
  async checkAccess(trackId: string, listenerWallet?: string): Promise<AccessCheckResult> {
    const track = await trackService.getTrackById(trackId);
    if (!track) {
      return { hasAccess: false, reason: 'TRACK_NOT_FOUND', price: 0 };
    }

    if (track.status !== 'PUBLISHED') {
      return { hasAccess: false, reason: 'TRACK_INACTIVE', price: track.price, track };
    }

    // Free tracks are open to everyone
    if (track.price <= 0) {
      return { hasAccess: true, reason: 'FREE_TRACK', price: 0, track };
    }

    // If no wallet provided, paid track requires pass
    if (!listenerWallet) {
      return { hasAccess: false, reason: 'PASS_REQUIRED', price: track.price, track };
    }

    // Check if listener has purchased a valid pass
    const hasPass = await passService.hasPass(trackId, listenerWallet);
    if (hasPass) {
      return { hasAccess: true, reason: 'PASS_CONFIRMED', price: track.price, track };
    }

    return { hasAccess: false, reason: 'PASS_REQUIRED', price: track.price, track };
  }

  /**
   * Start a streaming session for accounting purposes
   */
  async startSession(trackId: string, listenerWallet: string): Promise<StreamingSession> {
    const access = await this.checkAccess(trackId, listenerWallet);
    if (!access.hasAccess) {
      throw new Error(`ACCESS_DENIED: ${access.reason}`);
    }

    const db = await getDb();
    const sessionId = uuidv4();
    const now = new Date().toISOString();

    await db.execute(
      `INSERT INTO streaming_sessions (id, track_id, listener_wallet, started_at, duration, status, last_heartbeat)
       VALUES ($1, $2, $3, $4, 0, 'ACTIVE', $4)`,
      [sessionId, trackId, listenerWallet, now]
    );

    const session = await db.queryOne<StreamingSession>(
      'SELECT * FROM streaming_sessions WHERE id = $1',
      [sessionId]
    );
    return session!;
  }

  /**
   * Heartbeat to record ongoing playback duration and prevent falsified session lengths
   */
  async heartbeatSession(sessionId: string, durationSeconds?: number): Promise<StreamingSession> {
    const db = await getDb();
    const session = await db.queryOne<StreamingSession>(
      'SELECT * FROM streaming_sessions WHERE id = $1',
      [sessionId]
    );

    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }
    if (session.status !== 'ACTIVE') {
      return session;
    }

    const now = new Date().toISOString();
    // Default heartbeat increment is 10 seconds or provided validated offset
    const newDuration = durationSeconds !== undefined ? Math.max(session.duration, durationSeconds) : session.duration + 10;

    await db.execute(
      `UPDATE streaming_sessions
       SET duration = $1, last_heartbeat = $2
       WHERE id = $3`,
      [newDuration, now, sessionId]
    );

    const updated = await db.queryOne<StreamingSession>(
      'SELECT * FROM streaming_sessions WHERE id = $1',
      [sessionId]
    );
    return updated!;
  }

  /**
   * Conclude a playback session
   */
  async endSession(sessionId: string, finalDuration?: number): Promise<StreamingSession> {
    const db = await getDb();
    const session = await db.queryOne<StreamingSession>(
      'SELECT * FROM streaming_sessions WHERE id = $1',
      [sessionId]
    );

    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }

    const now = new Date().toISOString();
    const duration = finalDuration !== undefined ? Math.max(session.duration, finalDuration) : session.duration;

    await db.execute(
      `UPDATE streaming_sessions
       SET ended_at = $1, duration = $2, status = 'COMPLETED'
       WHERE id = $3`,
      [now, duration, sessionId]
    );

    const updated = await db.queryOne<StreamingSession>(
      'SELECT * FROM streaming_sessions WHERE id = $1',
      [sessionId]
    );
    return updated!;
  }

  /**
   * Retrieve streaming sessions for audits
   */
  async getSessions(options: { trackId?: string; wallet?: string } = {}): Promise<StreamingSession[]> {
    const db = await getDb();
    let query = 'SELECT * FROM streaming_sessions WHERE 1=1';
    const params: any[] = [];
    let pIdx = 1;

    if (options.trackId) {
      query += ` AND track_id = $${pIdx++}`;
      params.push(options.trackId);
    }
    if (options.wallet) {
      query += ` AND LOWER(listener_wallet) = LOWER($${pIdx++})`;
      params.push(options.wallet);
    }

    query += ' ORDER BY started_at DESC LIMIT 100';
    return await db.query<StreamingSession>(query, params);
  }
}

export const streamingService = new StreamingService();
