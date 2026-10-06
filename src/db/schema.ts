export type TrackStatus = 'DRAFT' | 'PUBLISHED';
export type MusicPassStatus = 'CONFIRMED' | 'FAILED' | 'PENDING';
export type StreamingSessionStatus = 'ACTIVE' | 'COMPLETED' | 'ABORTED';
export type TransactionStatus = 'CONFIRMED' | 'PENDING' | 'FAILED';

export interface User {
  id: string;
  wallet_address: string;
  role: 'LISTENER' | 'ARTIST' | 'ADMIN';
  created_at: string;
}

export interface Artist {
  id: string;
  wallet_address: string;
  display_name: string;
  bio: string | null;
  created_at: string;
}

export interface Track {
  id: string;
  artist_id: string;
  title: string;
  description: string | null;
  audio_reference: string;
  artwork_reference: string;
  price: number; // in XLM
  status: TrackStatus;
  genre: string | null;
  duration_seconds: number;
  created_at: string;
}

export interface MusicPass {
  id: string;
  track_id: string;
  purchaser_wallet: string;
  payment_amount: number;
  transaction_hash: string;
  status: MusicPassStatus;
  purchased_at: string;
}

export interface StreamingSession {
  id: string;
  track_id: string;
  listener_wallet: string;
  started_at: string;
  ended_at: string | null;
  duration: number; // in seconds
  status: StreamingSessionStatus;
  last_heartbeat: string;
}

export interface BlockchainTransaction {
  id: string;
  transaction_hash: string;
  type: string;
  wallet_address: string;
  amount: number;
  asset: string;
  status: TransactionStatus;
  ledger: number;
  created_at: string;
}

// Level 2 & 3 Architecture Foundation Entities
export interface SplitAgreement {
  id: string;
  track_id: string;
  version: number;
  is_locked: boolean;
  created_at: string;
}

export interface SplitContributor {
  id: string;
  agreement_id: string;
  wallet_address: string;
  basis_points: number; // 10000 = 100%
  has_signed: boolean;
  signature: string | null;
}
