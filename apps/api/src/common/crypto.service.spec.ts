import { randomBytes } from 'node:crypto';
import type { AppConfig } from '../config/config.module.js';
import { CryptoService } from './crypto.service.js';

function service(key = randomBytes(32).toString('base64')) {
  const values: Record<string, string> = { FIELD_ENCRYPTION_KEY: key, TOKEN_HASH_SECRET: 'x'.repeat(40) };
  return new CryptoService({ get: (k: string) => values[k] } as unknown as AppConfig);
}

describe('CryptoService', () => {
  it('round-trips text and JSON', () => {
    const crypto = service();
    expect(crypto.decrypt(crypto.encrypt('BRCA1_POSITIVE'))).toBe('BRCA1_POSITIVE');
    expect(crypto.decryptJson(crypto.encryptJson({ a: [1, 'b'] }))).toEqual({ a: [1, 'b'] });
  });

  it('uses a fresh IV each time', () => {
    const crypto = service();
    expect(crypto.encrypt('same')).not.toBe(crypto.encrypt('same'));
  });

  it('rejects tampered ciphertext', () => {
    const crypto = service();
    const parts = crypto.encrypt('secret').split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => crypto.decrypt(parts.join('.'))).toThrow();
  });

  it('cannot decrypt with another key', () => {
    const encrypted = service().encrypt('secret');
    expect(() => service().decrypt(encrypted)).toThrow();
  });

  it('compares hashes in constant time and correctly', () => {
    const crypto = service();
    const hash = crypto.hash('token');
    expect(crypto.hashEquals('token', hash)).toBe(true);
    expect(crypto.hashEquals('token2', hash)).toBe(false);
  });

  it('makes zero-padded numeric codes', () => {
    const crypto = service();
    for (let i = 0; i < 50; i++) expect(crypto.numericCode()).toMatch(/^[0-9]{6}$/);
  });
});
