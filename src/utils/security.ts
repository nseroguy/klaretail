import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = scryptSync(password, salt, 64);
    return timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

export function generateOtp(length = 6): { code: string; expiresAt: Date } {
  const digits = '0123456789';
  const buffer = randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += digits[buffer[i] % 10];
  }
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  return { code, expiresAt };
}
