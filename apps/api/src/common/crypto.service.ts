import { Global, Injectable, Module } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { AppConfig } from '../config/config.module.js';

const VERSION = 'v1';

/**
 * AES-256-GCM field encryption for health data, and keyed hashing for
 * tokens (OTP codes, refresh tokens, share links) so the database never
 * holds a usable secret.
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;
  private readonly hashSecret: string;

  constructor(config: AppConfig) {
    this.key = Buffer.from(config.get('FIELD_ENCRYPTION_KEY'), 'base64');
    this.hashSecret = config.get('TOKEN_HASH_SECRET');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
  }

  decrypt(payload: string): string {
    const [version, iv, tag, ciphertext] = payload.split('.');
    if (version !== VERSION || !iv || !tag || ciphertext === undefined) {
      throw new Error('Unrecognised encrypted payload');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
  }

  encryptNullable(value: string | null | undefined): string | null {
    return value === null || value === undefined ? null : this.encrypt(value);
  }

  decryptNullable(value: string | null | undefined): string | null {
    return value === null || value === undefined ? null : this.decrypt(value);
  }

  encryptJson(value: unknown): string {
    return this.encrypt(JSON.stringify(value));
  }

  decryptJson<T>(value: unknown): T | null {
    if (typeof value !== 'string') return null;
    return JSON.parse(this.decrypt(value)) as T;
  }

  /** Keyed hash for looking up and comparing tokens. */
  hash(value: string): string {
    return createHmac('sha256', this.hashSecret).update(value).digest('hex');
  }

  hashEquals(value: string, expectedHash: string): boolean {
    const actual = Buffer.from(this.hash(value), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  randomToken(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }

  numericCode(digits = 6): string {
    return randomInt(0, 10 ** digits)
      .toString()
      .padStart(digits, '0');
  }
}

@Global()
@Module({ providers: [CryptoService], exports: [CryptoService] })
export class CryptoModule {}
