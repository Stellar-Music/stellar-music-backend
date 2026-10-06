# 🎵 Stellar Music — Backend (`stellar-music-backend`)

Application API, streaming infrastructure, and Stellar payment reconciliation engine for **Stellar Music**.

## 📌 Architectural Responsibility & Core Principle

* **Backend manages application data, streaming infrastructure, indexing, and reconciliation.**
* **CRITICAL PRINCIPLE: The backend never has arbitrary authority to move user funds or alter locked agreements.**
* **Level 1**: Music Pass access and Stellar Testnet payment verification.
* **Level 2 (NEW)**: Multi-Party Collaborator Revenue Split Agreements:
  * Persistent storage of versioned agreements (`split_agreements`, `split_contributors`, `split_signatures`, `agreement_events`).
  * Cryptographic deterministic agreement terms hashing (`SHA-256`).
  * Strict 100.0% allocation enforcement.
  * Multi-party approval tracking and automatic transition to `LOCKED`.
  * Immutability guarantees: rejecting edits to locked agreements.
  * Active locked split query for Level 3 settlement readiness (`GET /api/tracks/:trackId/splits/active`).

```
       [ Frontend Client ]
          │          │
 (Stream Request)  (Submit Split / Sign)
          │          │
          ▼          ▼
   ┌────────────────────────────────┐
   │    Stellar Music Backend API   │
   │  - Payment Verification (L1)   │──────► [ Stellar Horizon Testnet ]
   │  - Range Audio Streaming (L1)  │
   │  - Revenue Split Engine (L2)   │
   │  - Agreement Hashing & Locking │
   └──────────────┬─────────────────┘
                  │
                  ▼
         [ PostgreSQL / SQLite ]
```

---

## 📡 API Endpoints

### Level 2: Revenue Split Agreements
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/tracks/:trackId/splits` | Track owner creates a new split agreement version with contributors. |
| `GET` | `/api/tracks/:trackId/splits` | Lists all agreement versions for a track. |
| `GET` | `/api/tracks/:trackId/splits/active` | Fetches active locked split agreement ready for Level 3 settlement. |
| `GET` | `/api/splits/:id` | Fetches agreement details, contributors, signatures, and lock status. |
| `POST` | `/api/splits/:id/sign` | Contributor signs/approves exact agreement terms. Locks when all sign. |
| `POST` | `/api/splits/:id/reject` | Contributor rejects proposed terms. |
| `GET` | `/api/splits/:id/history` | Audit trail events for agreement lifecycle. |
| `GET` | `/api/me/splits?wallet=G...` | Contributor Dashboard: query agreements involving the caller wallet. |

### Level 1: Core Tracks & Streaming
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/tracks` | Lists published tracks with optional filters. |
| `GET` | `/api/tracks/:id` | Get specific track metadata. |
| `POST` | `/api/tracks/upload` | Multipart file upload for audio and artwork files. |
| `POST` | `/api/tracks` | Publish or save draft track. |
| `GET` | `/api/tracks/:id/stream` | Protected range streaming (`206 Partial Content`). Enforces pass check. |
| `POST` | `/api/passes` | Verify Stellar Testnet payment & issue Music Pass. |
| `POST` | `/api/streams/start` | Start playback session (verifies access). |
| `POST` | `/api/streams/:id/heartbeat` | Send periodic heartbeat & increment duration. |
| `POST` | `/api/streams/:id/end` | Conclude playback session. |
| `POST` | `/api/wallet/fund` | 1-Click Friendbot Testnet wallet funding (10,000 XLM). |

---

## 🧪 Testing

Run the integration test suite:

```bash
npm test
```

Verifies:
* Track creation and access control (Level 1)
* Music Pass payment verification & replay rejection (Level 1)
* Streaming session lifecycle & heartbeats (Level 1)
* Revenue split 100% allocation enforcement (Level 2)
* Deterministic agreement SHA-256 hashing (Level 2)
* Multi-party contributor approval flow & locking (Level 2)
* Immutability of locked agreements (Level 2)
* Contributor Dashboard queries (Level 2)
