import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import path from 'node:path';
import dns from 'node:dns';
import { requestIdMiddleware } from './middleware/requestId.js';
import { healthRouter } from './routes/health.routes.js';
import { trackRouter } from './routes/track.routes.js';
import { artistRouter } from './routes/artist.routes.js';
import { passRouter } from './routes/pass.routes.js';
import { streamingRouter } from './routes/streaming.routes.js';
import { blockchainRouter } from './routes/blockchain.routes.js';
import { walletRouter } from './routes/wallet.routes.js';
import { splitRouter } from './routes/split.routes.js';
import { settlementRouter } from './routes/settlement.routes.js';
import { docsRouter } from './docs/openapi.js';

// Configure reliable DNS resolution for Stellar Horizon Testnet
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore in environments where setting DNS is restricted
}

export const app = express();

// Security headers with permissive resource policy for audio media streaming
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);

// Request rate limiting: 1000 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again later.' },
});
app.use(apiLimiter);

// Correlation tracing ID injection
app.use(requestIdMiddleware);

const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : '*';
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// Serve uploaded audio and artwork files
const uploadsPath = path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsPath));

// Health check endpoints
app.use('/api', healthRouter);
app.use('/api', docsRouter);

// Core API Routes
app.use('/api/tracks', trackRouter);
app.use('/api/artists', artistRouter);
app.use('/api/passes', passRouter);
app.use('/api/streams', streamingRouter);
app.use('/api/transactions', blockchainRouter);
app.use('/api/wallet', walletRouter);
app.use('/api', splitRouter);
app.use('/api', settlementRouter);

// Central error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled API Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});
