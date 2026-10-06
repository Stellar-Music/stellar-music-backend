import { Router, Request, Response } from 'express';
import { getDb } from '../db/database.js';
import { stellarService } from '../services/stellar.service.js';

export const blockchainRouter = Router();

/**
 * GET /api/transactions/:hash
 * Retrieve blockchain transaction verification record or query directly from Horizon
 */
blockchainRouter.get('/:hash', async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;
    const db = await getDb();

    // Check local recorded transactions first
    const localTx = await db.queryOne(
      'SELECT * FROM blockchain_transactions WHERE transaction_hash = $1',
      [hash]
    );

    if (localTx) {
      return res.json({
        success: true,
        source: 'local_database',
        data: localTx,
        explorer_url: `https://stellar.expert/explorer/testnet/tx/${hash}`,
      });
    }

    // Otherwise check Horizon Testnet live
    const horizonTx = await stellarService.getTransaction(hash);
    if (!horizonTx) {
      return res.status(404).json({ success: false, error: 'Transaction not found on Stellar Testnet' });
    }

    const ops = await stellarService.getTransactionOperations(hash);

    res.json({
      success: true,
      source: 'horizon_testnet',
      data: {
        hash: horizonTx.id,
        ledger: horizonTx.ledger,
        successful: horizonTx.successful,
        created_at: horizonTx.created_at,
        source_account: horizonTx.source_account,
        fee_charged: horizonTx.fee_charged,
        operations: ops,
      },
      explorer_url: `https://stellar.expert/explorer/testnet/tx/${hash}`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
