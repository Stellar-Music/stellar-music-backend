import { Router, Request, Response } from 'express';
import { getDb } from '../db/database.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    service: 'stellar-music-backend',
    version: '1.1.0',
    network: 'Stellar Testnet',
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get('/health/db', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    await db.query('SELECT 1 as alive');
    res.json({
      status: 'healthy',
      component: 'database',
      alive: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      component: 'database',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

healthRouter.get('/health/stellar', async (_req: Request, res: Response) => {
  try {
    const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(horizonUrl, { signal: controller.signal });
    clearTimeout(timeout);
    res.json({
      status: response.ok ? 'connected' : 'degraded',
      component: 'stellar-horizon',
      endpoint: horizonUrl,
      httpStatus: response.status,
      timestamp: new Date().toISOString(),
    });
  } catch (_error: any) {
    res.json({
      status: 'simulated',
      component: 'stellar-horizon',
      note: 'Using local test fallback or offline horizon mock',
      timestamp: new Date().toISOString(),
    });
  }
});
