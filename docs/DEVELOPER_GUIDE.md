# Stellar Music Backend — Architecture & Developer Guide

This guide is designed for core maintainers, security auditors, and hackathon judges seeking deep technical insight into the architecture, design choices, and engineering patterns governing `stellar-music-backend`.

---

## 1. System Architecture

`stellar-music-backend` operates as an off-chain orchestration, streaming delivery, and payment reconciliation engine connecting the web client to the Stellar blockchain and Soroban smart contracts.

```
┌─────────────────┐      HTTP REST / SSE       ┌────────────────────────┐
│  React Frontend │ ◄────────────────────────► │ Stellar Music Backend  │
└─────────────────┘                            └───────────┬────────────┘
                                                           │
                      ┌────────────────────────────────────┼───────────────────────────┐
                      ▼                                    ▼                           ▼
          ┌───────────────────────┐            ┌───────────────────────┐    ┌─────────────────────┐
          │   PostgreSQL 16 DB    │            │  Stellar Horizon RPC  │    │ Soroban RPC Node    │
          │ (Splits, Plays, Logs) │            │ (Ledgers, Tx Hashes)  │    │ (Pass / Split State)│
          └───────────────────────┘            └───────────────────────┘    └─────────────────────┘
```

---

## 2. Directory Layout & Module Responsibilities

```
src/
├── app.ts                  # Express server definition, security middlewares (Helmet, CORS)
├── index.ts                # HTTP listener boot, database connectivity check, graceful shutdown
├── config/
│   └── env.ts              # Zod-validated environment configuration schema
├── db/
│   ├── database.ts         # Connection pool, transaction wrapper, query runner
│   ├── schema.sql          # Primary DDL definitions (Artists, Tracks, Splits, Settlements)
│   └── seed.ts             # Deterministic mock/testnet data populator
├── middleware/
│   ├── authStream.ts       # HMAC-SHA256 streaming authorization validator
│   ├── mediaCache.ts       # Cache-Control headers for immutable audio assets
│   ├── requestId.ts        # UUID correlation tracing per HTTP request
│   └── validate.ts         # Zod schema request body/query validation interceptor
├── routes/
│   ├── artist.routes.ts    # Artist profile registration, updates, and catalog discovery
│   ├── track.routes.ts     # Track uploads, audio metadata extraction, and listings
│   ├── split.routes.ts     # Multi-party revenue split proposal, signing, and locking
│   ├── settlement.routes.ts# Real-time accounting, SSE live feed, and Stellar payouts
│   └── streaming.routes.ts # Range-request chunked audio delivery and play counters
├── services/
│   ├── stellar.service.ts  # Horizon RPC pool with automated fallback failover
│   ├── streamingToken.ts   # High-throughput cryptographic stream token signing
│   ├── rangeParser.ts      # HTTP 206 partial content offset calculator
│   └── settlement.service.ts# Stroop accounting reconciliation and batch distribution
└── validators/             # Zod input schemas enforcing boundary validation
```

---

## 3. Core Design Principles

### 3.1 Strict Integer Stroop Math
To prevent floating-point rounding errors common in financial applications, all monetary accounting (tips, streaming royalties, split distributions) is calculated strictly in **integer stroops** (1 XLM = 10,000,000 stroops).
- A 0-stroop invariant test confirms that `sum(individual_splits) == total_pool` across all splits without loss.

### 3.2 Defensive Horizon Failover
Stellar Horizon nodes occasionally experience network jitter or rate limits. The `HorizonRpcPool` automatically cycles between primary and backup Horizon instances, maintaining continuous transaction inspection.

### 3.3 Stateless Stream Authorization
Audio chunks are protected by short-lived HMAC-SHA256 signatures (`generateStreamToken`). The backend validates incoming tokens in `O(1)` time without performing a database lookup per chunk, preserving low-latency playback under high concurrency.

---

## 4. Error Response Format

All API errors return a standard JSON envelope:

```json
{
  "error": "Error message description",
  "code": "SPECIFIC_ERROR_CODE",
  "requestId": "4689b7b9-1234-4567-8901-abcdef012345",
  "details": [
    {
      "field": "walletAddress",
      "message": "Invalid Stellar Ed25519 public key"
    }
  ]
}
```

---

## 5. Testing Philosophy

1. **Unit Tests**: Focus on pure algorithmic calculations (range parser, streaming token HMAC, stroop arithmetic).
2. **Integration Tests**: Supertest HTTP integration verifying database queries, route handlers, and error codes.
3. **Endurance & Memory Tests**: Memory heap growth profiling under 500+ iterations to verify zero resource retention.
4. **Zero Flakiness**: Tests run sequentially (`--fileParallelism=false`) against deterministic in-memory/isolated states.
