/**
 * Mock Stellar Horizon Client for offline testing and deterministic CI execution
 */
export interface MockTransactionResponse {
  id: string;
  successful: boolean;
  hash: string;
  ledger: number;
  created_at: string;
  source_account: string;
  fee_charged: number;
  memo?: string;
}

export class StellarMockClient {
  private mockAccounts: Map<string, { balance: string; exists: boolean }> = new Map();
  private mockTransactions: Map<string, MockTransactionResponse> = new Map();

  constructor() {
    // Pre-seed known test accounts
    this.mockAccounts.set('GASTRALDRIFT7777777777777777777777777777777777777777', {
      balance: '10000.0000000',
      exists: true,
    });
    this.mockAccounts.set('GCONTRIBUTOR1111111111111111111111111111111111111111', {
      balance: '500.0000000',
      exists: true,
    });
  }

  async getAccount(address: string): Promise<{ exists: boolean; balance: string }> {
    if (this.mockAccounts.has(address)) {
      return this.mockAccounts.get(address)!;
    }
    return { exists: false, balance: '0' };
  }

  async fundWithFriendbot(address: string): Promise<{ successful: boolean; message: string }> {
    this.mockAccounts.set(address, { balance: '10000.0000000', exists: true });
    return {
      successful: true,
      message: `Successfully funded account ${address} with 10,000 testnet XLM.`,
    };
  }

  async getTransaction(txHash: string): Promise<MockTransactionResponse> {
    if (this.mockTransactions.has(txHash)) {
      return this.mockTransactions.get(txHash)!;
    }

    // Default mock valid transaction for testing
    return {
      id: txHash,
      successful: true,
      hash: txHash,
      ledger: 1234567,
      created_at: new Date().toISOString(),
      source_account: 'GASTRALDRIFT7777777777777777777777777777777777777777',
      fee_charged: 100,
      memo: 'MUSIC_PASS',
    };
  }

  registerTransaction(tx: MockTransactionResponse) {
    this.mockTransactions.set(tx.hash, tx);
  }
}

export const stellarMock = new StellarMockClient();
