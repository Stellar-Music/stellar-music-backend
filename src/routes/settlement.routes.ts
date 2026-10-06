import { Router, Request, Response } from 'express';
import { settlementService } from '../services/settlement.service.js';
import { splitService } from '../services/split.service.js';
import { trackService } from '../services/track.service.js';

export const settlementRouter = Router();

/**
 * POST /api/settlements/run
 * Trigger automated settlement cycle across all eligible tracks
 */
settlementRouter.post('/settlements/run', async (_req: Request, res: Response) => {
  try {
    const result = await settlementService.runAutomatedSettlementCycle();
    res.json({
      success: true,
      message: `Executed ${result.settlements_executed} settlements totalling ${result.total_settled_xlm.toFixed(2)} XLM.`,
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/settlements/track/:trackId
 * Execute automated multi-recipient settlement for a specific track
 */
settlementRouter.post('/settlements/track/:trackId', async (req: Request, res: Response) => {
  try {
    const { trackId } = req.params;
    const { amount, pool_id } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid settlement amount is required.' });
    }

    const result = await settlementService.executeTrackSettlement(trackId, parseFloat(amount), pool_id);
    res.status(201).json({
      success: true,
      message: 'Settlement executed and verified on Stellar Testnet.',
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/settlements
 * List settlements history with optional track filter
 */
settlementRouter.get('/settlements', async (req: Request, res: Response) => {
  try {
    const trackId = req.query.track_id as string | undefined;
    const list = await settlementService.getSettlements(trackId);
    res.json({ success: true, count: list.length, data: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/settlements/:id
 * Get single settlement receipt with recipient allocations
 */
settlementRouter.get('/settlements/:id', async (req: Request, res: Response) => {
  try {
    const data = await settlementService.getSettlementById(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: 'Settlement not found.' });
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/settlements/reconcile/:id
 * Independent blockchain reconciliation of settlement record
 */
settlementRouter.get('/settlements/reconcile/:id', async (req: Request, res: Response) => {
  try {
    const reconciliation = await settlementService.reconcileSettlement(req.params.id);
    res.json({ success: true, data: reconciliation });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/revenue/pools
 * List platform revenue pools and unallocated balances
 */
settlementRouter.get('/revenue/pools', async (_req: Request, res: Response) => {
  try {
    const pools = await settlementService.getRevenuePools();
    res.json({ success: true, count: pools.length, data: pools });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/revenue/track/:trackId
 * Track-level revenue summary, active locked split, and settlement history
 */
settlementRouter.get('/revenue/track/:trackId', async (req: Request, res: Response) => {
  try {
    const { trackId } = req.params;
    const track = await trackService.getTrackById(trackId);
    if (!track) return res.status(404).json({ success: false, error: 'Track not found.' });

    const lockedSplit = await splitService.getActiveLockedSplit(trackId);
    const settlements = await settlementService.getSettlements(trackId);

    const totalSettled = settlements.reduce((acc, s) => acc + s.gross_amount, 0);

    res.json({
      success: true,
      data: {
        track,
        locked_agreement: lockedSplit?.agreement || null,
        contributors: lockedSplit?.contributors || [],
        total_settled_xlm: totalSettled,
        settlement_count: settlements.length,
        settlements,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/earnings/contributor/:wallet
 * Contributor earnings dashboard (Total earned, pending, settled, and track breakdown)
 */
settlementRouter.get('/earnings/contributor/:wallet', async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;
    const summary = await settlementService.getContributorEarnings(wallet);
    res.json({ success: true, data: summary });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/earnings/artist/:wallet
 * Artist revenue dashboard summary across all tracks
 */
settlementRouter.get('/earnings/artist/:wallet', async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;
    const summary = await settlementService.getArtistRevenue(wallet);
    res.json({ success: true, data: summary });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/realtime/events
 * Server-Sent Events stream for realtime settlement & earnings updates
 */
settlementRouter.get('/realtime/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial connected ping
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

  const unsubscribe = settlementService.subscribe((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  req.on('close', () => {
    unsubscribe();
  });
});
