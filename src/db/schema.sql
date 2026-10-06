-- Stellar Music Level 1 PostgreSQL Schema
-- With Architectural Foundations for Level 2 (Agreements) and Level 3 (Settlement)

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    wallet_address VARCHAR(64) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'LISTENER',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS artists (
    id VARCHAR(64) PRIMARY KEY,
    wallet_address VARCHAR(64) UNIQUE NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tracks (
    id VARCHAR(64) PRIMARY KEY,
    artist_id VARCHAR(64) NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    audio_reference TEXT NOT NULL,
    artwork_reference TEXT NOT NULL,
    price NUMERIC(12, 4) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    genre VARCHAR(60),
    duration_seconds INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tracks_status ON tracks(status);
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist_id);

CREATE TABLE IF NOT EXISTS music_passes (
    id VARCHAR(64) PRIMARY KEY,
    track_id VARCHAR(64) NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    purchaser_wallet VARCHAR(64) NOT NULL,
    payment_amount NUMERIC(12, 4) NOT NULL,
    transaction_hash VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_music_passes_lookup ON music_passes(track_id, purchaser_wallet);
CREATE INDEX IF NOT EXISTS idx_music_passes_tx ON music_passes(transaction_hash);

CREATE TABLE IF NOT EXISTS streaming_sessions (
    id VARCHAR(64) PRIMARY KEY,
    track_id VARCHAR(64) NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    listener_wallet VARCHAR(64) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_streaming_sessions_track ON streaming_sessions(track_id);
CREATE INDEX IF NOT EXISTS idx_streaming_sessions_wallet ON streaming_sessions(listener_wallet);

CREATE TABLE IF NOT EXISTS blockchain_transactions (
    id VARCHAR(64) PRIMARY KEY,
    transaction_hash VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL,
    wallet_address VARCHAR(64) NOT NULL,
    amount NUMERIC(18, 7) NOT NULL,
    asset VARCHAR(20) NOT NULL DEFAULT 'XLM',
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
    ledger BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- Level 2 & 3 Architectural Extension Foundation (Ready for future releases)
-- =========================================================================

CREATE TABLE IF NOT EXISTS revenue_pools (
    id VARCHAR(64) PRIMARY KEY,
    track_id VARCHAR(64) NOT NULL REFERENCES tracks(id),
    total_revenue NUMERIC(18, 7) NOT NULL DEFAULT 0,
    settled_revenue NUMERIC(18, 7) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS split_agreements (
    id VARCHAR(64) PRIMARY KEY,
    track_id VARCHAR(64) NOT NULL REFERENCES tracks(id),
    version INT NOT NULL DEFAULT 1,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS split_contributors (
    id VARCHAR(64) PRIMARY KEY,
    agreement_id VARCHAR(64) NOT NULL REFERENCES split_agreements(id) ON DELETE CASCADE,
    wallet_address VARCHAR(64) NOT NULL,
    basis_points INT NOT NULL, -- 10000 = 100%
    has_signed BOOLEAN NOT NULL DEFAULT FALSE,
    signature TEXT
);

CREATE TABLE IF NOT EXISTS settlements (
    id VARCHAR(64) PRIMARY KEY,
    pool_id VARCHAR(64) NOT NULL REFERENCES revenue_pools(id),
    agreement_id VARCHAR(64) NOT NULL REFERENCES split_agreements(id),
    total_distributed NUMERIC(18, 7) NOT NULL,
    settlement_tx_hash VARCHAR(100),
    settled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
