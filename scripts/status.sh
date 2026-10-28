#!/usr/bin/env bash
# Stellar Music Backend - Comprehensive Service Status Inspector
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
HORIZON_URL="${STELLAR_HORIZON_URL:-https://horizon-testnet.stellar.org}"

echo "========================================================"
echo "         Stellar Music Backend Status Inspector        "
echo "========================================================"

echo "[1/4] Checking Local Runtime Environment..."
echo "  Node: $(node --version 2>/dev/null || echo 'Not installed')"
echo "  NPM:  v$(npm --version 2>/dev/null || echo 'Not installed')"
echo "  Git Branch: $(git branch --show-current 2>/dev/null || echo 'Unknown')"
echo "  Head Commit: $(git rev-parse --short HEAD 2>/dev/null || echo 'Unknown')"

echo ""
echo "[2/4] Inspecting API Service Endpoints (${BACKEND_URL})..."
if curl -sf "${BACKEND_URL}/api/health" > /dev/null 2>&1; then
  HEALTH_PAYLOAD=$(curl -s "${BACKEND_URL}/api/health")
  echo "  [LIVE] /api/health is UP:"
  echo "         ${HEALTH_PAYLOAD}"
else
  echo "  [DOWN] /api/health did not respond (Server may not be running locally on port 3001)"
fi

if curl -sf "${BACKEND_URL}/api/health/ready" > /dev/null 2>&1; then
  echo "  [READY] /api/health/ready passed database and RPC readiness checks"
else
  echo "  [UNREADY] /api/health/ready failed or server is offline"
fi

echo ""
echo "[3/4] Inspecting Stellar Horizon Network (${HORIZON_URL})..."
if curl -sf "${HORIZON_URL}/" > /dev/null 2>&1; then
  HORIZON_VER=$(curl -s "${HORIZON_URL}/" | grep -o '"horizon_version": *"[^"]*"' || echo "Connected")
  echo "  [OK] Stellar Testnet Horizon is accessible: ${HORIZON_VER}"
else
  echo "  [WARN] Unable to reach Stellar Horizon at ${HORIZON_URL}"
fi

echo ""
echo "[4/4] Inspecting Database Containers..."
if command -v docker > /dev/null 2>&1; then
  if docker ps --format '{{.Names}}: {{.Status}}' | grep -i "stellar-music-db" > /dev/null 2>&1; then
    echo "  [OK] Postgres container is active: $(docker ps --filter "name=stellar-music-db" --format '{{.Names}} ({{.Status}})')"
  else
    echo "  [INFO] Postgres container 'stellar-music-db' is not running in Docker (SQLite fallback active if PG not configured)"
  fi
else
  echo "  [SKIP] Docker not found on host path."
fi

echo "========================================================"
echo "Status check finished."
