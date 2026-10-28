import { Request, Response, NextFunction } from 'express';
import { verifyStreamToken } from '../services/streamingToken.js';

export interface AuthenticatedStreamRequest extends Request {
  streamAuth?: {
    trackId: string;
    walletAddress: string;
    expiresAt: number;
  };
}

export function authStreamMiddleware(
  req: AuthenticatedStreamRequest,
  res: Response,
  next: NextFunction
): void {
  const token =
    (req.query.token as string) ||
    req.header('x-stream-token') ||
    req.header('authorization')?.replace(/^Bearer\s+/i, '');

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Missing streaming access token. Please provide token via query or authorization header.',
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

  const routeTrackId = req.params.trackId || req.params.id;
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
