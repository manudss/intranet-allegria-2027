import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.util';

describe('password util', () => {
  it('hashes and verifies a password', () => {
    const encoded = hashPassword('demo-password');

    expect(encoded.startsWith('scrypt$')).toBe(true);
    expect(verifyPassword('demo-password', encoded)).toBe(true);
    expect(verifyPassword('wrong-password', encoded)).toBe(false);
  });
});

