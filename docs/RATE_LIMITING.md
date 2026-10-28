# Stellar Music Backend — Rate Limiting & DoS Defense Specification

## 1. Threat Mitigation Philosophy

As an open Web3 platform with free-tier access and decentralized media streaming, the backend enforces multi-tiered rate limiting to prevent:
1. Denial of Service (DoS) attacks on audio gateways.
2. Brute-force guessing attacks against HMAC streaming secrets.
3. Database connection pool exhaustion.

---

## 2. Rate Limiting Tiers

| Endpoint Tier | Route Prefix | Window | Max Requests | Response Code on Violation |
| :--- | :--- | :---: | :---: | :---: |
| **Standard API** | `/api/tracks`, `/api/artists` | 15 minutes | 100 req | `429 Too Many Requests` |
| **Token Issuing** | `/api/streaming/token` | 1 minute | 30 req | `429 Too Many Requests` |
| **Media Chunking**| `/api/streaming/stream/:id` | 1 minute | 600 req | `429 Too Many Requests` |
| **Health Probes** | `/api/health`, `/api/health/ready` | 1 minute | 120 req | `429 Too Many Requests` |

---

## 3. Standardized Rate Limit Headers

Every HTTP response includes RFC 6585 rate limiting headers:

```http
RateLimit-Limit: 100
RateLimit-Remaining: 84
RateLimit-Reset: 1700000900
Retry-After: 900
```

---

## 4. HTTP 429 Error Envelope

When a client breaches rate limits, the server returns:

```json
{
  "error": "Too many requests from this IP. Please wait before retrying.",
  "code": "RATE_LIMIT_EXCEEDED",
  "requestId": "e1f2a3b4-5678-90ab-cdef-1234567890ab",
  "retryAfterSeconds": 900
}
```
