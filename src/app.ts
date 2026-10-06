import express from 'express';
import cors from 'cors';
import path from 'node:path';
import dns from 'node:dns';
import { trackRouter } from './routes/track.routes.js';
import { artistRouter } from './routes/artist.routes.js';
import { passRouter } from './routes/pass.routes.js';
import { streamingRouter } from './routes/streaming.routes.js';
import { blockchainRouter } from './routes/blockchain.routes.js';
import { walletRouter } from './routes/wallet.routes.js';
import { splitRouter } from './routes/split.routes.js';

// Configure reliable DNS resolution for Stellar Horizon Testnet
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore in environments where setting DNS is restricted
}

export const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// Serve uploaded audio and artwork files
const uploadsPath = path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsPath));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    service: 'stellar-music-backend',
    version: '1.0.0',
    network: 'Stellar Testnet',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/tracks', trackRouter);
app.use('/api/artists', artistRouter);
app.use('/api/passes', passRouter);
app.use('/api/streams', streamingRouter);
app.use('/api/transactions', blockchainRouter);
app.use('/api/wallet', walletRouter);
app.use('/api', splitRouter);

// Central error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled API Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});
