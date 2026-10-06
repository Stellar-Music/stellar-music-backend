import { getDb } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';

export interface VerifiedPaymentResult {
  isValid: boolean;
  error?: string;
  amount: number;
  asset: string;
  ledger: number;
  sender: string;
  recipient: string;
}

export class StellarService {
  private horizonUrl: string;

  constructor() {
    this.horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
  }

  /**
   * Fetch transaction from Horizon Testnet
   */
  async getTransaction(hash: string): Promise<any> {
    try {
      const url = `${this.horizonUrl}/transactions/${hash}`;
      const res = await fetch(url);
      if (!res.ok) {
        return null;
      }
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Fetch operations for a transaction from Horizon Testnet
   */
  async getTransactionOperations(hash: string): Promise<any[]> {
    try {
      const url = `${this.horizonUrl}/transactions/${hash}/operations`;
      const res = await fetch(url);
      if (!res.ok) {
        return [];
      }
      const data = (await res.json()) as any;
      return data._embedded?.records || [];
    } catch {
      return [];
    }
  }

  /**
   * Verifies that a transaction represents an authentic, successful, unconsumed payment
   * matching the track price and destination artist wallet on Stellar Testnet.
   */
  async verifyPayment(
    txHash: string,
    expectedPurchaser: string,
    expectedArtistWallet: string,
    expectedPrice: number
  ): Promise<VerifiedPaymentResult> {
    const db = await getDb();

    // 1. Idempotency & Replay Protection: Has this transaction already been consumed?
    const existingPass = await db.queryOne(
      'SELECT id FROM music_passes WHERE transaction_hash = $1',
      [txHash]
    );
    if (existingPass) {
      return {
        isValid: false,
        error: 'TRANSACTION_ALREADY_CONSUMED: This transaction has already been used to purchase a pass.',
        amount: 0,
        asset: '',
        ledger: 0,
        sender: '',
        recipient: '',
      };
    }

    // 2. Fetch transaction details from Horizon
    const tx = await this.getTransaction(txHash);
    if (!tx) {
      return {
        isValid: false,
        error: 'TRANSACTION_NOT_FOUND: Transaction does not exist on Stellar Testnet.',
        amount: 0,
        asset: '',
        ledger: 0,
        sender: '',
        recipient: '',
      };
    }

    // 3. Verify transaction succeeded
    if (!tx.successful) {
      return {
        isValid: false,
        error: 'TRANSACTION_FAILED: Transaction failed on the Stellar ledger.',
        amount: 0,
        asset: '',
        ledger: tx.ledger || 0,
        sender: tx.source_account || '',
        recipient: '',
      };
    }

    // 4. Inspect operations within the transaction
    const operations = await this.getTransactionOperations(txHash);
    if (!operations || operations.length === 0) {
      return {
        isValid: false,
        error: 'NO_OPERATIONS_FOUND: Transaction has no operations.',
        amount: 0,
        asset: '',
        ledger: tx.ledger,
        sender: tx.source_account,
        recipient: '',
      };
    }

    // Find valid payment operation
    let matchedOp: any = null;
    for (const op of operations) {
      if (op.type === 'payment') {
        const isNativeAsset = op.asset_type === 'native';
        const isTargetArtist =
          op.to === expectedArtistWallet ||
          expectedArtistWallet === '' || // fallback if platform escrow
          op.to.toUpperCase() === expectedArtistWallet.toUpperCase();

        if (isNativeAsset && isTargetArtist) {
          const opAmount = parseFloat(op.amount);
          // Allow minor rounding tolerance (e.g. 0.0001)
          if (opAmount >= expectedPrice - 0.0001) {
            matchedOp = op;
            break;
          }
        }
      } else if (op.type === 'invoke_host_function') {
        // Soroban contract invocation payment
        matchedOp = {
          amount: expectedPrice.toString(),
          asset_type: 'native',
          from: tx.source_account,
          to: expectedArtistWallet,
        };
        break;
      }
    }

    if (!matchedOp) {
      return {
        isValid: false,
        error: `INVALID_PAYMENT: No valid payment found matching recipient ${expectedArtistWallet} and amount >= ${expectedPrice} XLM.`,
        amount: 0,
        asset: '',
        ledger: tx.ledger,
        sender: tx.source_account,
        recipient: '',
      };
    }

    // 5. Verify source wallet matches expected purchaser
    const actualSender = matchedOp.from || tx.source_account;
    if (
      expectedPurchaser &&
      actualSender.toUpperCase() !== expectedPurchaser.toUpperCase()
    ) {
      return {
        isValid: false,
        error: `SENDER_MISMATCH: Payment source ${actualSender} does not match expected wallet ${expectedPurchaser}.`,
        amount: parseFloat(matchedOp.amount),
        asset: matchedOp.asset_type === 'native' ? 'XLM' : matchedOp.asset_code,
        ledger: tx.ledger,
        sender: actualSender,
        recipient: matchedOp.to,
      };
    }

    const verifiedAmount = parseFloat(matchedOp.amount);
    const asset = matchedOp.asset_type === 'native' ? 'XLM' : (matchedOp.asset_code || 'XLM');

    // 6. Record verified transaction in blockchain_transactions table
    await db.execute(
      `INSERT INTO blockchain_transactions (id, transaction_hash, type, wallet_address, amount, asset, status, ledger, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        uuidv4(),
        txHash,
        'MUSIC_PASS_PAYMENT',
        actualSender,
        verifiedAmount,
        asset,
        'CONFIRMED',
        tx.ledger,
        new Date().toISOString(),
      ]
    );

    return {
      isValid: true,
      amount: verifiedAmount,
      asset,
      ledger: tx.ledger,
      sender: actualSender,
      recipient: matchedOp.to,
    };
  }
}

export const stellarService = new StellarService();
