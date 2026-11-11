import { Request, Response, NextFunction } from 'express';
import { verifyStreamToken } from '../services/streamingToken.js';
import { TrackService } from '../services/track.service.js';

const trackService = new TrackService();

export interface AuthenticatedStreamRequest extends Request {
  streamAuth?: {
    trackId: string;
    walletAddress: string;
    expiresAt: number;
  };
}

export async function authStreamMiddleware(
  req: AuthenticatedStreamRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token =
    (req.query.token as string) ||
    req.header('x-stream-token') ||
    req.header('authorization')?.replace(/^Bearer\s+/i, '');

  const routeTrackId = req.params.trackId || req.params.id;

  if (!token) {
    if (routeTrackId) {
      try {
        const track = await trackService.getTrackById(routeTrackId);
        if (track && track.price === 0) {
          return next();
        }
      } catch {
        // proceed to require token
      }
    }
    res.status(401).json({
      success: false,
      error:
        'Missing streaming access token. Please provide token via query or authorization header.',
    });
    return;
  }

  const result = verifyStreamToken(token);
  if (!result.valid || !result.payload) {
    res.status(403).json({
      success: false,
      error: result.error || 'Invalid or expired streaming token.',
    });
    return;
  }

  if (routeTrackId && result.payload.trackId !== routeTrackId) {
    res.status(403).json({
      success: false,
      error: 'Streaming token is not authorized for the requested track.',
    });
    return;
  }

  req.streamAuth = result.payload;
  next();
}
