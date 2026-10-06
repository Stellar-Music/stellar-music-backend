import { Router, Request, Response } from 'express';
import { passService } from '../services/pass.service.js';

export const passRouter = Router();

/**
 * POST /api/passes
 * Verify Stellar Testnet payment and issue Music Pass
 */
passRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { track_id, purchaser_wallet, transaction_hash } = req.body;

    if (!track_id || !purchaser_wallet || !transaction_hash) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: track_id, purchaser_wallet, transaction_hash',
      });
    }

    const result = await passService.purchasePass({
      track_id,
      purchaser_wallet,
      transaction_hash,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to verify payment',
      });
    }

    res.status(201).json({
      success: true,
      data: result.pass,
      explorer_url: `https://stellar.expert/explorer/testnet/tx/${transaction_hash}`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/passes
 * Query passes with optional wallet or track filter
 */
passRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { wallet, track_id } = req.query;
    const passes = await passService.getPasses({
      wallet: wallet as string,
      trackId: track_id as string,
    });
    res.json({ success: true, count: passes.length, data: passes });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/passes/:id
 * Get pass by ID
 */
passRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const pass = await passService.getPassById(req.params.id);
    if (!pass) {
      return res.status(404).json({ success: false, error: 'Music Pass not found' });
    }
    res.json({ success: true, data: pass });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/passes/check/:trackId/:wallet
 * Instant check if wallet holds a confirmed pass for a track
 */
passRouter.get('/check/:trackId/:wallet', async (req: Request, res: Response) => {
  try {
    const { trackId, wallet } = req.params;
    const hasPass = await passService.hasPass(trackId, wallet);
    res.json({ success: true, hasAccess: hasPass });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
