import { Router, Request, Response } from 'express';

export const walletRouter = Router();

/**
 * POST /api/wallet/fund
 * Requests Friendbot funding on Stellar Testnet (10,000 Testnet XLM)
 */
walletRouter.post('/fund', async (req: Request, res: Response) => {
  try {
    const { wallet_address } = req.body;
    if (!wallet_address) {
      return res.status(400).json({ success: false, error: 'wallet_address is required.' });
    }

    const friendbotUrl = `https://friendbot.stellar.org/?addr=${encodeURIComponent(wallet_address)}`;
    const response = await fetch(friendbotUrl);
    const data = (await response.json()) as any;

    if (!response.ok) {
      return res.status(400).json({
        success: false,
        error: data.detail || 'Friendbot funding failed',
      });
    }

    res.json({
      success: true,
      message: 'Account funded with 10,000 Testnet XLM',
      data,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/wallet/balance/:address
 * Fetches current Testnet XLM balance from Horizon
 */
walletRouter.get('/balance/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
    const response = await fetch(`${horizonUrl}/accounts/${address}`);

    if (response.status === 404) {
      return res.json({
        success: true,
        exists: false,
        balance: '0',
        message: 'Account not funded yet on Stellar Testnet',
      });
    }

    if (!response.ok) {
      return res.status(400).json({ success: false, error: 'Failed to fetch account balance' });
    }

    const data = (await response.json()) as any;
    const nativeBalance = data.balances?.find((b: any) => b.asset_type === 'native');

    res.json({
      success: true,
      exists: true,
      balance: nativeBalance ? nativeBalance.balance : '0',
      balances: data.balances,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
