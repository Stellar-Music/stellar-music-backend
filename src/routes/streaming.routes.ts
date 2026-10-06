import { Router, Request, Response } from 'express';
import { streamingService } from '../services/streaming.service.js';

export const streamingRouter = Router();

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
