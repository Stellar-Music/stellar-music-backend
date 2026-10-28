import { Router, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { streamingService } from '../services/streaming.service.js';
import { TrackService } from '../services/track.service.js';
import { generateStreamToken } from '../services/streamingToken.js';
import { parseByteRange } from '../services/rangeParser.js';
import { mediaCacheMiddleware } from '../middleware/mediaCache.js';

const trackService = new TrackService();
export const streamingRouter = Router();

/**
 * POST /api/streams/token
 * Generate a short-lived HMAC token for authenticated audio chunk streaming
 */
streamingRouter.post('/token', async (req: Request, res: Response) => {
  try {
    const { track_id, wallet_address, ttl_seconds } = req.body;
    if (!track_id || !wallet_address) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: track_id, wallet_address',
      });
    }

    const ttl = ttl_seconds ? parseInt(ttl_seconds, 10) : 3600;
    const token = generateStreamToken(track_id, wallet_address, ttl);
    res.json({
      success: true,
      data: {
        token,
        track_id,
        wallet_address,
        expires_in: ttl,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/streams/:trackId/play
 * Stream audio chunks with HTTP 206 Partial Content and Range header support
 */
streamingRouter.get('/:trackId/play', mediaCacheMiddleware(), async (req: Request, res: Response) => {
  try {
    const { trackId } = req.params;
    const track = await trackService.getTrackById(trackId);
    if (!track) {
      return res.status(404).json({ success: false, error: 'Track not found' });
    }

    const audioPath = path.isAbsolute(track.audio_reference)
      ? track.audio_reference
      : path.join(process.cwd(), track.audio_reference);

    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ success: false, error: 'Audio file not found on disk' });
    }

    const stat = fs.statSync(audioPath);
    const rangeHeader = req.headers.range;
    const range = parseByteRange(rangeHeader, stat.size);

    if (range) {
      res.status(206);
      res.setHeader('Content-Range', range.contentRangeHeader);
      res.setHeader('Content-Length', range.chunkLength);
      res.setHeader('Content-Type', 'audio/mpeg');
      const stream = fs.createReadStream(audioPath, { start: range.start, end: range.end });
      stream.pipe(res);
    } else {
      res.status(200);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Type', 'audio/mpeg');
      const stream = fs.createReadStream(audioPath);
      stream.pipe(res);
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/streams/start
 * Initiate a streaming playback session
 */
streamingRouter.post('/start', async (req: Request, res: Response) => {
  try {
    const { track_id, listener_wallet } = req.body;
    if (!track_id || !listener_wallet) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: track_id, listener_wallet',
      });
    }

    const session = await streamingService.startSession(track_id, listener_wallet);
    res.status(201).json({ success: true, data: session });
  } catch (err: any) {
    if (err.message.includes('ACCESS_DENIED')) {
      return res.status(403).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/streams/:id/heartbeat
 * Periodic heartbeat to record validated playback duration
 */
streamingRouter.post('/:id/heartbeat', async (req: Request, res: Response) => {
  try {
    const { duration_seconds } = req.body;
    const session = await streamingService.heartbeatSession(
      req.params.id,
      duration_seconds ? parseInt(duration_seconds, 10) : undefined
    );
    res.json({ success: true, data: session });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/streams/:id/end
 * Conclude playback session
 */
streamingRouter.post('/:id/end', async (req: Request, res: Response) => {
  try {
    const { duration_seconds } = req.body;
    const session = await streamingService.endSession(
      req.params.id,
      duration_seconds ? parseInt(duration_seconds, 10) : undefined
    );
    res.json({ success: true, data: session });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/streams
 * Audit query for recorded playback sessions
 */
streamingRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { track_id, wallet } = req.query;
    const sessions = await streamingService.getSessions({
      trackId: track_id as string,
      wallet: wallet as string,
    });
    res.json({ success: true, count: sessions.length, data: sessions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
