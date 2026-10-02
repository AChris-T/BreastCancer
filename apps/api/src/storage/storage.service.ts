import { GetObjectCommand, DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Global, Injectable, Module } from '@nestjs/common';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { CryptoService } from '../common/crypto.service.js';
import { AppConfig } from '../config/config.module.js';

export const SIGNED_URL_TTL_SECONDS = 5 * 60;

export interface SignedUrl {
  url: string;
  expiresAt: string;
}

/**
 * Private object storage. Files are addressed by key only; the browser gets
 * access through short-lived signed URLs, never a public URL.
 */
@Injectable()
export class StorageService {
  private readonly s3: S3Client | null;
  private readonly bucket: string;
  private readonly localRoot: string;

  constructor(
    private readonly config: AppConfig,
    private readonly crypto: CryptoService,
  ) {
    this.bucket = config.get('S3_BUCKET') ?? '';
    this.localRoot = resolve(config.get('STORAGE_LOCAL_DIR'));
    this.s3 =
      config.get('STORAGE_DRIVER') === 's3'
        ? new S3Client({
            region: config.get('S3_REGION'),
            endpoint: config.get('S3_ENDPOINT'),
            credentials:
              config.get('S3_ACCESS_KEY_ID') && config.get('S3_SECRET_ACCESS_KEY')
                ? { accessKeyId: config.get('S3_ACCESS_KEY_ID')!, secretAccessKey: config.get('S3_SECRET_ACCESS_KEY')! }
                : undefined,
          })
        : null;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, ServerSideEncryption: 'AES256' }),
      );
      return;
    }
    const path = this.localPath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  async get(key: string): Promise<Buffer> {
    if (this.s3) {
      const result = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return Buffer.from(await result.Body!.transformToByteArray());
    }
    return readFile(this.localPath(key));
  }

  async delete(key: string): Promise<void> {
    if (!key) return;
    if (this.s3) {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      return;
    }
    await rm(this.localPath(key), { force: true });
  }

  async signedUrl(key: string, contentType: string): Promise<SignedUrl> {
    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000);
    if (this.s3) {
      const url = await getSignedUrl(
        this.s3,
        new GetObjectCommand({ Bucket: this.bucket, Key: key, ResponseContentType: contentType, ResponseCacheControl: 'no-store' }),
        { expiresIn: SIGNED_URL_TTL_SECONDS },
      );
      return { url, expiresAt: expiresAt.toISOString() };
    }
    const payload = Buffer.from(JSON.stringify({ k: key, m: contentType, e: expiresAt.getTime() })).toString('base64url');
    const token = `${payload}.${this.crypto.hash(`file:${payload}`)}`;
    return { url: `${this.config.get('API_PUBLIC_URL')}/api/v1/files/${token}`, expiresAt: expiresAt.toISOString() };
  }

  /** Validates a local signed-URL token; returns the key and type, or null if forged or expired. */
  verifyLocalToken(token: string): { key: string; contentType: string } | null {
    const [payload, signature] = token.split('.');
    if (!payload || !signature || !this.crypto.hashEquals(`file:${payload}`, signature)) return null;
    try {
      const { k, m, e } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { k: string; m: string; e: number };
      return e > Date.now() ? { key: k, contentType: m } : null;
    } catch {
      return null;
    }
  }

  get isLocal() {
    return !this.s3;
  }

  private localPath(key: string): string {
    const path = resolve(this.localRoot, key);
    if (!path.startsWith(this.localRoot + sep)) throw new Error('Invalid storage key');
    return path;
  }
}

@Global()
@Module({ providers: [StorageService], exports: [StorageService] })
export class StorageModule {}
