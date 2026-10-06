import { Router, Request, Response } from 'express';
import { splitService } from '../services/split.service.js';

export const splitRouter = Router();

/**
 * POST /api/tracks/:trackId/splits
 * Track owner creates a new revenue split agreement version
 */
splitRouter.post('/tracks/:trackId/splits', async (req: Request, res: Response) => {
  try {
    const { trackId } = req.params;
    const { created_by_wallet, contributors } = req.body;

    if (!created_by_wallet || !contributors) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: created_by_wallet, contributors',
      });
    }

    const result = await splitService.createAgreement(
      trackId,
      created_by_wallet,
      contributors
    );

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/tracks/:trackId/splits
 * List all split agreements/versions for a track
 */
splitRouter.get('/tracks/:trackId/splits', async (req: Request, res: Response) => {
  try {
    const { trackId } = req.params;
    const agreements = await splitService.getAgreementsByTrack(trackId);
    res.json({ success: true, count: agreements.length, data: agreements });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/tracks/:trackId/splits/active
 * Get active locked split for track (Level 3 settlement ready)
 */
splitRouter.get('/tracks/:trackId/splits/active', async (req: Request, res: Response) => {
  try {
    const { trackId } = req.params;
    const active = await splitService.getActiveLockedSplit(trackId);
    if (!active) {
      return res.status(404).json({
        success: false,
        error: 'NO_ACTIVE_LOCKED_SPLIT: No locked split agreement found for this track.',
      });
    }
    res.json({ success: true, data: active });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/splits/:id
 * Retrieve specific split agreement with contributors and signatures
 */
splitRouter.get('/splits/:id', async (req: Request, res: Response) => {
  try {
    const data = await splitService.getAgreementById(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, error: 'Agreement not found' });
    }
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/splits/:id/sign
 * Contributor signs/approves exact agreement terms
 */
splitRouter.post('/splits/:id/sign', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { contributor_wallet, signature_ref } = req.body;

    if (!contributor_wallet) {
      return res.status(400).json({ success: false, error: 'contributor_wallet is required.' });
    }

    const result = await splitService.signAgreement(id, contributor_wallet, signature_ref);
    res.json({
      success: true,
      message: result.isLocked ? 'All signatures collected! Agreement LOCKED.' : 'Approval recorded.',
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/splits/:id/reject
 * Contributor rejects an agreement
 */
splitRouter.post('/splits/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { contributor_wallet, reason } = req.body;

    if (!contributor_wallet) {
      return res.status(400).json({ success: false, error: 'contributor_wallet is required.' });
    }

    const updated = await splitService.rejectAgreement(id, contributor_wallet, reason);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/splits/:id/history
 * Audit trail events for agreement lifecycle
 */
splitRouter.get('/splits/:id/history', async (req: Request, res: Response) => {
  try {
    const data = await splitService.getAgreementById(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: 'Agreement not found' });
    res.json({ success: true, data: data.events });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/splits/:id/submit
 * Transitions a DRAFT agreement to AWAITING_SIGNATURES
 */
splitRouter.post('/splits/:id/submit', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = await splitService.getAgreementById(id);
    if (!data) return res.status(404).json({ success: false, error: 'Agreement not found' });

    if (data.agreement.status === 'LOCKED') {
      return res.status(400).json({ success: false, error: 'Agreement is already LOCKED.' });
    }

    res.json({
      success: true,
      message: 'Agreement submitted for signatures.',
      data: data.agreement,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/splits/:id/lock
 * Explicitly lock agreement once all required signatures are collected
 */
splitRouter.post('/splits/:id/lock', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = await splitService.getAgreementById(id);
    if (!data) return res.status(404).json({ success: false, error: 'Agreement not found' });

    if (data.agreement.status === 'LOCKED') {
      return res.json({ success: true, message: 'Agreement already LOCKED.', data: data.agreement });
    }

    const allSigned = data.contributors.every((c) => Boolean(c.has_signed));
    if (!allSigned) {
      return res.status(400).json({
        success: false,
        error: 'CANNOT_LOCK: All required contributors must sign before locking.',
      });
    }

    const result = await splitService.signAgreement(id, data.contributors[0].wallet_address);
    res.json({ success: true, message: 'Agreement LOCKED.', data: result.agreement });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/me/splits
 * Contributor Dashboard: query agreements involving the caller wallet
 */
splitRouter.get('/me/splits', async (req: Request, res: Response) => {
  try {
    const wallet = req.query.wallet as string;
    if (!wallet) {
      return res.status(400).json({ success: false, error: 'wallet query parameter is required.' });
    }

    const dashboard = await splitService.getSplitsForWallet(wallet);
    res.json({ success: true, data: dashboard });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
