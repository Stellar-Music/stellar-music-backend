# Stellar Music Backend — Local Development Guide

Welcome to the backend service for **Stellar Music**, the decentralized, streaming-native music monetization platform built on the Stellar Network and Soroban smart contracts.

This document walks you through spinning up the backend API, configuring database persistence, seeding testnet catalog tracks, and verifying streaming cryptographic integrity.

---

## 1. Prerequisites

- **Node.js**: `v20.x` or later (LTS recommended)
- **Package Manager**: `npm` v10+
- **Database Engine**:
  - **Docker & Docker Compose** (Recommended for local PostgreSQL 16)
  - OR native PostgreSQL installation
  - Built-in SQLite memory/file fallback mode if `DATABASE_URL` is omitted
- **Stellar Account**: Keypair for testnet testing (funded via Friendbot)

---

## 2. Quickstart

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Environment Configuration
Copy the documented `.env.example` file to `.env`:
```bash
cp .env.example .env
```

Key environment configurations:
| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `3001` | Express HTTP server port |
| `NODE_ENV` | `development` | Runtime environment mode |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/stellar_music` | PostgreSQL connection URI |
| `STELLAR_NETWORK` | `TESTNET` | `TESTNET` or `PUBLIC` |
| `STELLAR_HORIZON_URL`| `https://horizon-testnet.stellar.org` | Primary Stellar Horizon node |
| `STELLAR_HORIZON_FALLBACK_URL` | `https://testnet.stellar.org` | Secondary failover RPC node |
| `STREAM_SECRET_KEY` | *(32+ char secret)* | Secret key for signing audio access HMACs |

### Step 3: Launch PostgreSQL Database
Start the containerized PostgreSQL database with health checks:
```bash
docker compose up -d
```
Verify container status:
```bash
docker compose ps
```

### Step 4: Seed Database Catalog
Populate the database with Afrobeats, Synthwave, and Lo-Fi testnet demo tracks and split agreements:
```bash
npm run seed
```

### Step 5: Start Development Server
```bash
npm run dev
```
The server will boot on `http://localhost:3001`.
- OpenAPI documentation: `http://localhost:3001/api/docs`
- Health check: `http://localhost:3001/api/health`
- Readiness check: `http://localhost:3001/api/health/ready`

---

## 3. Running Test Suites

Stellar Music Backend maintains high test coverage with zero external mocking requirements.

```bash
# Run all unit, integration, and stress tests
npm test

# Run test suite with V8 code coverage analysis
npm run test:coverage

# Run specific memory leak endurance test
npx vitest run tests/memory_leak.test.ts
```

---

## 4. Benchmarking & Security Audits

The backend includes purpose-built profiling utilities in `scripts/`:

```bash
# 1. Benchmark audio streaming latency, TTFB, and chunk throughput
npx tsx scripts/benchmark-stream.ts

# 2. Benchmark REST endpoint response latency under load
npx tsx scripts/benchmark-api.ts

# 3. Inspect local environment, database containers, and Horizon connectivity
bash scripts/status.sh

# 4. Audit codebase for exposed private keys or secret seeds
bash scripts/audit-secrets.sh
```

---

## 5. Architectural Overview

- **`src/services/stellar.service.ts`**: Horizon RPC pool with automatic failover across multi-region endpoints.
- **`src/services/streamingToken.ts`**: High-performance HMAC-SHA256 streaming authorization token generator.
- **`src/services/rangeParser.ts`**: HTTP 206 Partial Content byte range parser supporting resilient audio seeking.
- **`src/routes/settlement.routes.ts`**: Server-Sent Events (SSE) broadcaster with automated keep-alive ping cycles.
