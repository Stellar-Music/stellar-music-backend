# Stellar Music Backend API Reference

The Stellar Music Backend provides non-custodial REST APIs, streaming session accounting, cryptographic HMAC-SHA256 streaming tokens, and automated multi-party revenue settlement execution on the Stellar Horizon Testnet.

---

## Interactive Documentation

- **Swagger UI Interactive Explorer**: `http://localhost:3001/api/docs`
- **Machine-Readable OpenAPI 3.0 Specification**: `http://localhost:3001/api/docs.json`

---

## Base URLs

- **Local Development**: `http://localhost:3001`
- **Stellar Horizon Target**: `https://horizon-testnet.stellar.org`
- **Soroban RPC Target**: `https://soroban-testnet.stellar.org`

---

## Core Endpoints

### 1. System Health & Probes

#### `GET /api/health`
Returns process uptime, environment, and system status.
```bash
curl -X GET http://localhost:3001/api/health
```
**Response (200 OK):**
```json
{
  "status": "ok",
  "service": "stellar-music-backend",
  "version": "1.2.0",
  "uptime": 142.5
}
```

#### `GET /api/health/db`
Probes database connectivity and query responsiveness.

#### `GET /api/health/stellar`
Probes Stellar Horizon Testnet RPC reachability.

---

### 2. Audio Track Catalog

#### `GET /api/tracks`
Query available audio tracks with optional filtering.
- Query Parameters:
  - `genre` (string, optional): Filter by genre (e.g. `Electronic`, `Afrobeats`)
  - `search` (string, optional): Search keyword against title or artist

#### `GET /api/tracks/:id`
Fetch single track metadata including audio reference, cover art, and pass price in stroops.

#### `POST /api/tracks`
Publish a new track (multipart/form-data with audio and artwork files).

---

### 3. Music Passes & Access Rights

#### `GET /api/passes`
List confirmed passes.
- Query Parameters:
  - `wallet` (string, optional): Filter by buyer's Stellar public key
  - `track_id` (string, optional): Filter by track ID

#### `POST /api/passes`
Record and independently verify a Stellar on-chain payment transaction for a music pass.
```json
{
  "track_id": "uuid",
  "purchaser_wallet": "GASTRALDRIFT7777777777777777777777777777777777777777",
  "payment_amount": 5.0,
  "transaction_hash": "64_char_hex_hash"
}
```

---

### 4. Audio Streaming Engine

#### `GET /api/tracks/:id/stream`
HTTP 206 Partial Content byte-range audio streaming with authenticated access verification.
- Query Parameters:
  - `wallet` (string, optional): Buyer's Stellar public key
  - `token` (string, optional): Cryptographic HMAC-SHA256 streaming token

#### `POST /api/streams/start`
Begin streaming session accounting.

#### `POST /api/streams/:id/heartbeat`
Send periodic playback heartbeat (every 10s) to record duration.

#### `POST /api/streams/:id/end`
Conclude streaming session and finalize accounting record.

---

### 5. Multi-Party Revenue Splits

#### `POST /api/splits`
Create a new cryptographic multi-party split agreement.
```json
{
  "track_id": "uuid",
  "creator_wallet": "GASTRALDRIFT7777777777777777777777777777777777777777",
  "contributors": [
    {
      "wallet_address": "GASTRALDRIFT7777777777777777777777777777777777777777",
      "display_name": "Lead Artist",
      "role": "Artist",
      "percentage": 60.0
    },
    {
      "wallet_address": "GCONTRIBUTOR1111111111111111111111111111111111111111",
      "display_name": "Producer",
      "role": "Producer",
      "percentage": 40.0
    }
  ]
}
```
*Note: Total collaborator allocations must sum to exactly 100.0% (10,000 Basis Points).*

#### `POST /api/splits/:id/sign`
Submit cryptographic signature from a collaborator wallet. Once all contributors sign, status transitions to `LOCKED`.

---

### 6. Automated Multi-Recipient Settlement

#### `POST /api/settlements/run`
Trigger automated settlement cycle distributing accumulated pass revenue to collaborators according to their locked split shares.

#### `GET /api/settlements`
List historical settlements with on-chain transaction hashes.

#### `GET /api/settlements/export?format=csv`
Download complete settlement ledger history as RFC 4180 CSV export.

#### `GET /api/revenue/pending`
Summary of pending un-settled revenue across tracks or filtered by contributor wallet (`?wallet=G...`).

---

## Security & Architecture

1. **Non-Custodial Design**: The backend never holds private keys. All pass purchases and royalty payouts execute directly on Stellar.
2. **Replay Attack Prevention**: Transaction hashes submitted for pass verification are recorded and checked for duplicates.
3. **HTTP 206 Byte-Range Streaming**: Enables efficient audio scrubbing and rapid playback startup without downloading the entire media file.
4. **Correlation Tracing**: Every request receives an `X-Request-Id` correlation header for traceability.
