import { Router, Request, Response } from 'express';
import { trackService } from '../services/track.service.js';
import { streamingService } from '../services/streaming.service.js';
import { upload } from '../middleware/upload.middleware.js';
import path from 'node:path';
import fs from 'node:fs';

export const trackRouter = Router();

/**
 * GET /api/tracks
 * Lists published tracks with optional filtering
 */
trackRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { status, genre, artistId, search } = req.query;
    const tracks = await trackService.getTracks({
      status: status ? (status as any) : 'PUBLISHED',
      genre: genre as string,
      artistId: artistId as string,
      search: search as string,
    });
    res.json({ success: true, count: tracks.length, data: tracks });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/tracks/:id
 * Fetches single track details
 */
trackRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const track = await trackService.getTrackById(req.params.id);
    if (!track) {
      return res.status(404).json({ success: false, error: 'Track not found' });
    }
    res.json({ success: true, data: track });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/tracks/upload
 * Handles file uploads for track audio and cover artwork
 */
trackRouter.post(
  '/upload',
  upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'artwork', maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const audioFile = files?.audio?.[0];
      const artworkFile = files?.artwork?.[0];

      if (!audioFile) {
        return res.status(400).json({ success: false, error: 'Audio file is required.' });
      }

      const audioRef = `/uploads/${audioFile.filename}`;
      const artworkRef = artworkFile
        ? `/uploads/${artworkFile.filename}`
        : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80';

      res.json({
        success: true,
        data: {
          audio_reference: audioRef,
          artwork_reference: artworkRef,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * POST /api/tracks
 * Artist publishes or saves draft track
 */
trackRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      artist_id,
      title,
      description,
      audio_reference,
      artwork_reference,
      price,
      status,
      genre,
      duration_seconds,
    } = req.body;

    if (!artist_id || !title || !audio_reference || !artwork_reference) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: artist_id, title, audio_reference, artwork_reference',
      });
    }

    const priceNum = typeof price === 'number' ? price : parseFloat(price || '0');
    if (isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({ success: false, error: 'Price must be a non-negative number.' });
    }

    const track = await trackService.createTrack({
      artist_id,
      title,
      description,
      audio_reference,
      artwork_reference,
      price: priceNum,
      status: status || 'PUBLISHED',
      genre,
      duration_seconds: duration_seconds ? parseInt(duration_seconds, 10) : 180,
    });

    res.status(201).json({ success: true, data: track });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/tracks/:id
 * Updates track metadata, price, or publication status
 */
trackRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const updated = await trackService.updateTrack(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Track not found' });
    }
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/tracks/:id/stream
 * Secure audio streaming endpoint supporting HTTP Range requests
 * Enforces Music Pass access validation
 */
trackRouter.get('/:id/stream', async (req: Request, res: Response) => {
  try {
    const trackId = req.params.id;
    const listenerWallet = (req.query.wallet as string) || '';

    // Verify access
    const access = await streamingService.checkAccess(trackId, listenerWallet);
    if (!access.hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'MUSIC_PASS_REQUIRED',
        message: 'A confirmed Music Pass is required to stream this track.',
        track_id: trackId,
        price: access.price,
      });
    }

    const track = access.track!;
    let filePath = track.audio_reference;

    // If local relative file in uploads
    if (filePath.startsWith('/uploads/')) {
      filePath = path.join(process.cwd(), filePath);
    } else if (filePath.startsWith('uploads/')) {
      filePath = path.join(process.cwd(), filePath);
    }

    if (!fs.existsSync(filePath)) {
      // If external URL, redirect
      if (track.audio_reference.startsWith('http')) {
        return res.redirect(track.audio_reference);
      }
      return res.status(404).json({ success: false, error: 'Audio file not found on server.' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // HTTP 206 Partial Content range stream
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        res.status(416).send(`Requested range not satisfiable\n${start} >= ${fileSize}`);
        return;
      }

      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/mpeg',
      };

      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'audio/mpeg',
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
