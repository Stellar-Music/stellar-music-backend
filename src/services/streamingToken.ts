import crypto from 'node:crypto';

export interface StreamTokenPayload {
  trackId: string;
  walletAddress: string;
  expiresAt: number; // Unix timestamp in seconds
}

const DEFAULT_SECRET = process.env.STREAM_SECRET_KEY || 'stellar-music-default-hmac-secret-key-32chars!';
const DEFAULT_TTL_SECONDS = 3600; // 1 hour

export function generateStreamToken(
  trackId: string,
  walletAddress: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
  secret: string = DEFAULT_SECRET
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payloadStr = `${trackId}:${walletAddress}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
  return Buffer.from(`${payloadStr}:${signature}`).toString('base64url');
}

export function verifyStreamToken(
  token: string,
  secret: string = DEFAULT_SECRET
): { valid: boolean; payload?: StreamTokenPayload; error?: string } {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 4) {
      return { valid: false, error: 'Malformed token structure' };
    }
    const [trackId, walletAddress, expiresAtStr, signature] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt)) {
      return { valid: false, error: 'Invalid expiration timestamp' };
    }
    if (Math.floor(Date.now() / 1000) > expiresAt) {
      return { valid: false, error: 'Streaming token expired' };
    }
    const expectedPayload = `${trackId}:${walletAddress}:${expiresAtStr}`;
    const expectedSignature = crypto.createHmac('sha256', secret).update(expectedPayload).digest('hex');
    const valid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
    if (!valid) {
      return { valid: false, error: 'Invalid HMAC signature' };
    }
    return { valid: true, payload: { trackId, walletAddress, expiresAt } };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Token verification failed' };
  }
}
