export type TrackStatus = 'DRAFT' | 'PUBLISHED';
export type MusicPassStatus = 'CONFIRMED' | 'FAILED' | 'PENDING';
export type StreamingSessionStatus = 'ACTIVE' | 'COMPLETED' | 'ABORTED';
export type TransactionStatus = 'CONFIRMED' | 'PENDING' | 'FAILED';

export type SplitAgreementStatus =
  | 'DRAFT'
  | 'AWAITING_SIGNATURES'
  | 'PARTIALLY_SIGNED'
  | 'LOCKED'
  | 'REJECTED'
  | 'SUPERSEDED';

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

// =========================================================================
// LEVEL 2: REVENUE SPLIT AGREEMENT MODELS
// =========================================================================

export interface SplitAgreement {
  id: string;
  track_id: string;
  version: number;
  status: SplitAgreementStatus;
  agreement_hash: string; // Deterministic SHA-256 of agreement terms
  created_by: string;     // Creator's Stellar wallet
  created_at: string;
  locked_at: string | null;
}

export interface SplitContributor {
  id: string;
  agreement_id: string;
  wallet_address: string;
  display_name: string;
  role: string;          // Artist, Producer, Songwriter, Composer, Engineer, Label, etc.
  percentage: number;    // e.g. 50.0 (sum must equal 100.0)
  share_basis_points: number; // 5000 (sum must equal 10000)
  has_signed: boolean;
  signed_at: string | null;
  signature_ref: string | null;
}

export interface SplitSignature {
  id: string;
  agreement_id: string;
  contributor_id: string;
  wallet_address: string;
  signature_hash: string;
  signed_at: string;
}

export interface AgreementEvent {
  id: string;
  agreement_id: string;
  event_type:
    | 'CREATED'
    | 'CONTRIBUTOR_ADDED'
    | 'TERMS_UPDATED'
    | 'SUBMITTED'
    | 'SIGNATURE_REQUESTED'
    | 'SIGNED'
    | 'REJECTED'
    | 'LOCKED'
    | 'SUPERSEDED';
  performed_by: string;
  details: string;
  created_at: string;
}
