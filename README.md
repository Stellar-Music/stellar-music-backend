# 🎵 Stellar Music — Backend (`stellar-music-backend`)

Application API, streaming infrastructure, and Stellar Testnet payment reconciliation engine for **Stellar Music**.

## 📌 Architectural Responsibility & Core Principle

* **Backend manages application data, streaming infrastructure, indexing, and reconciliation.**
* **CRITICAL PRINCIPLE: The backend never has arbitrary authority to move user funds.** Payments flow directly between listeners and artists (or smart contracts) on the Stellar ledger. The backend strictly acts as an independent verifier and indexer.
* **Idempotent Payment Verification**: Every Music Pass purchase must be backed by a verified, successful Stellar Testnet transaction on Horizon before access is granted.

```
       [ Frontend Client ]
          │          │
 (Stream Request)  (Submit Tx Hash)
          │          │
          ▼          ▼
   ┌────────────────────────────────┐
   │    Stellar Music Backend API   │
   │  - Payment Verification        │──────► [ Stellar Horizon Testnet ]
   │  - Access Authorization        │        (Verify Tx, Op, Amount, To)
   │  - Range Audio Streaming       │
   │  - Streaming Accounting        │
   └──────────────┬─────────────────┘
                  │
                  ▼
         [ PostgreSQL / SQLite ]
```

---

## 🗄️ Database Architecture & Entities

The system supports **PostgreSQL** (production standard) with an automatic zero-config **SQLite** fallback for local development.

### Core Relational Models

1. **`User`**: `id`, `wallet_address`, `role` (`LISTENER` | `ARTIST` | `ADMIN`), `created_at`
2. **`Artist`**: `id`, `wallet_address`, `display_name`, `bio`, `created_at`
3. **`Track`**: `id`, `artist_id`, `title`, `description`, `audio_reference`, `artwork_reference`, `price` (XLM), `status` (`DRAFT` | `PUBLISHED`), `genre`, `duration_seconds`, `created_at`
4. **`MusicPass`**: `id`, `track_id`, `purchaser_wallet`, `payment_amount`, `transaction_hash`, `status` (`CONFIRMED` | `FAILED`), `purchased_at`
5. **`StreamingSession`**: `id`, `track_id`, `listener_wallet`, `started_at`, `ended_at`, `duration`, `status` (`ACTIVE` | `COMPLETED`), `last_heartbeat`
6. **`BlockchainTransaction`**: `id`, `transaction_hash`, `type`, `wallet_address`, `amount`, `asset`, `status`, `ledger`, `created_at`

### Level 2 & 3 Schema Extensibility (Included in `schema.sql`)
* `revenue_pools`: Future pooled streaming revenue tracking.
* `split_agreements` & `split_contributors`: Multi-party signed royalty agreements.
* `settlements`: Real-time automatic payouts to collaborators.

---

## 🔍 Stellar Payment Verification Engine

The backend rejects client declarations of "Payment successful". When `POST /api/passes` is called:

1. **Replay & Idempotency Check**: Queries `music_passes` to guarantee `transaction_hash` has not been consumed previously.
2. **Horizon Transaction Check**: Fetches transaction record from `https://horizon-testnet.stellar.org/transactions/:hash`. Verifies `successful === true`.
3. **Operation Inspection**: Examines `operations` array:
   - Validates operation `type === 'payment'`.
   - Validates destination wallet matches the track's artist address.
   - Validates asset is native (`XLM`).
   - Validates paid amount >= track price.
   - Validates source account matches the purchaser wallet.
4. **Audit Logging**: Inserts verified record into `blockchain_transactions`.
5. **Access Grant**: Records confirmed `MusicPass`.

---

## 📡 API Endpoints

### Tracks
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/tracks` | Lists published tracks with optional `genre` and `search` query. |
| `GET` | `/api/tracks/:id` | Get specific track metadata. |
| `POST` | `/api/tracks/upload` | Multipart file upload for audio and artwork files. |
| `POST` | `/api/tracks` | Publish or save draft track. |
| `PATCH` | `/api/tracks/:id` | Update track metadata, status, or pricing. |
| `GET` | `/api/tracks/:id/stream` | Protected range streaming (`206 Partial Content`). Enforces pass check. |

### Artists
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/artists` | List all artists. |
| `GET` | `/api/artists/:id` | Get artist profile by ID or wallet address. |
| `POST` | `/api/artists` | Register new artist profile. |

### Music Passes
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/passes` | Verify Stellar Testnet payment & issue Music Pass. |
| `GET` | `/api/passes` | List passes filtered by `wallet` or `track_id`. |
| `GET` | `/api/passes/:id` | Get pass receipt. |
| `GET` | `/api/passes/check/:trackId/:wallet` | Instant boolean access check. |

### Streaming Accounting
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/streams/start` | Start playback session (verifies access). |
| `POST` | `/api/streams/:id/heartbeat` | Send periodic heartbeat & increment duration. |
| `POST` | `/api/streams/:id/end` | Conclude playback session. |
| `GET` | `/api/streams` | Audit playback sessions. |

### Blockchain & Wallet
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/transactions/:hash` | Query Stellar transaction details. |
| `POST` | `/api/wallet/fund` | 1-Click Friendbot Testnet wallet funding (10,000 XLM). |
| `GET` | `/api/wallet/balance/:address` | Fetch live Testnet XLM balance. |

---

## 🚀 Getting Started

### 1. Installation
```bash
npm install
```

### 2. Environment Configuration
Copy the template configuration:
```bash
cp .env.example .env
```

### 3. Optional: Start PostgreSQL with Docker
```bash
docker compose up -d
```
*(If Docker/Postgres is not running, the backend automatically uses SQLite at `data/stellar_music.db`).*

### 4. Run Test Suite
```bash
npm test
```

### 5. Build & Start Server
```bash
npm run build
npm start
```

Or for development with hot-reload:
```bash
npm run dev
```

Server runs on: `http://localhost:4000`
Health check: `http://localhost:4000/api/health`
