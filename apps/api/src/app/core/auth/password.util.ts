import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const HASH_PREFIX = 'scrypt';

export const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `${HASH_PREFIX}$${salt}$${hash}`;
};

export const verifyPassword = (password: string, encodedHash: string): boolean => {
  const [prefix, salt, hash] = encodedHash.split('$');

  if (prefix !== HASH_PREFIX || !salt || !hash) {
    return false;
  }

  const computedHash = scryptSync(password, salt, 32);
  const storedHash = Buffer.from(hash, 'hex');

  if (computedHash.length !== storedHash.length) {
    return false;
  }

  return timingSafeEqual(computedHash, storedHash);
};

