#!/usr/bin/env bash
# Stellar Music Backend - Secret & Credential Pre-flight Security Scanner
set -euo pipefail

echo "========================================================"
echo "  Stellar Music - Security & Secret Credential Audit"
echo "========================================================"

FOUND_SECRETS=0

# Pattern 1: Stellar Secret Seeds (starts with S and 55 alphanum uppercase characters)
echo "[1/4] Scanning for exposed Stellar Secret Seeds (S... 56 chars)..."
if grep -rnE "\bS[A-Z2-7]{55}\b" src/ 2>/dev/null; then
  echo "  [FAIL] Unmasked Stellar secret seed detected in src/!"
  FOUND_SECRETS=$((FOUND_SECRETS + 1))
else
  echo "  [PASS] No exposed Stellar secret seeds in source files."
fi

# Pattern 2: RSA / EC Private Keys
echo "[2/4] Scanning for raw PEM private key headers..."
if grep -rn "BEGIN.*PRIVATE KEY" src/ 2>/dev/null; then
  echo "  [FAIL] Raw PEM private key block found in src/!"
  FOUND_SECRETS=$((FOUND_SECRETS + 1))
else
  echo "  [PASS] No raw private key blocks found."
fi

# Pattern 3: Hardcoded database passwords in non-example files
echo "[3/4] Scanning for hardcoded postgres connection credentials..."
if grep -rnE "postgres://[^:]+:[^@]+@" src/ 2>/dev/null | grep -v "example\|sample"; then
  echo "  [FAIL] Hardcoded Postgres credentials detected in source code!"
  FOUND_SECRETS=$((FOUND_SECRETS + 1))
else
  echo "  [PASS] Database credentials properly isolated behind environment variables."
fi

# Pattern 4: Live production API keys or tokens
echo "[4/4] Scanning for unmasked production tokens..."
if grep -rnE "(AWS_SECRET_ACCESS_KEY|SECRET_KEY)\s*=\s*['\"][A-Za-z0-9+/]{20,}['\"]" src/ 2>/dev/null; then
  echo "  [FAIL] Hardcoded secret key detected!"
  FOUND_SECRETS=$((FOUND_SECRETS + 1))
else
  echo "  [PASS] No unmasked production secrets detected."
fi

echo "========================================================"
if [ "$FOUND_SECRETS" -gt 0 ]; then
  echo "  [ERROR] Security audit failed with $FOUND_SECRETS violation(s)!"
  exit 1
else
  echo "  [SUCCESS] All security credential checks passed cleanly."
  exit 0
fi
