import { Request, Response, NextFunction } from 'express';

export function mediaCacheMiddleware(maxAgeSeconds: number = 86400) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('Cache-Control', `public, max-age=${maxAgeSeconds}, stale-while-revalidate=3600`);
    res.setHeader('Accept-Ranges', 'bytes');
    next();
  };
}
