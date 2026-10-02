import { createHash } from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';
import heicConvert from 'heic-convert';
import sharp from 'sharp';
import { UPLOAD_MAX_BYTES } from '@breastscan/shared';

export class UploadRejection extends Error {}

export type AcceptedMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic' | 'application/pdf';

const SIGNATURE_TO_MIME: Record<string, AcceptedMime> = {
  'image/jpeg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
  'image/heic': 'image/heic',
  'image/heif': 'image/heic',
  'image/heic-sequence': 'image/heic',
  'image/heif-sequence': 'image/heic',
  'application/pdf': 'application/pdf',
};

export const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/** Identifies the file by its signature (magic bytes), never by name or declared type. */
export async function detectMime(buffer: Buffer): Promise<AcceptedMime> {
  if (buffer.length === 0) throw new UploadRejection('The file is empty');
  if (buffer.length > UPLOAD_MAX_BYTES) throw new UploadRejection('The file is larger than 25 MB');
  const detected = await fileTypeFromBuffer(buffer);
  const mime = detected ? SIGNATURE_TO_MIME[detected.mime] : undefined;
  if (!mime) throw new UploadRejection('This file type is not supported. Upload a JPG, PNG, WEBP, HEIC or PDF.');
  return mime;
}

/** Password-protected PDFs can't be read by the model, so they are refused up front. */
export function isEncryptedPdf(buffer: Buffer): boolean {
  // The /Encrypt entry lives in the trailer or a cross-reference stream dictionary.
  return /\/Encrypt\s*(\d+\s+\d+\s+R|<<)/.test(buffer.toString('latin1'));
}

export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export interface SanitisedFile {
  buffer: Buffer;
  mimeType: string;
  extension: string;
}

/**
 * Re-encodes images so EXIF/GPS and other metadata are dropped (sharp keeps
 * no metadata unless asked) and orientation is baked in. HEIC is converted
 * to JPEG. PDFs are stored unchanged.
 */
export async function sanitise(buffer: Buffer, mime: AcceptedMime): Promise<SanitisedFile> {
  if (mime === 'application/pdf') return { buffer, mimeType: mime, extension: 'pdf' };

  let source = buffer;
  let target: 'jpeg' | 'png' | 'webp' = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpeg';
  if (mime === 'image/heic') {
    try {
      source = Buffer.from(await heicConvert({ buffer, format: 'JPEG', quality: 0.95 }));
    } catch {
      throw new UploadRejection('We could not read this HEIC image. Try exporting it as JPG.');
    }
    target = 'jpeg';
  }

  try {
    const image = sharp(source, { failOn: 'error', limitInputPixels: 30_000 * 30_000 }).rotate();
    const output =
      target === 'png'
        ? await image.png({ compressionLevel: 9 }).toBuffer()
        : target === 'webp'
          ? await image.webp({ lossless: true }).toBuffer()
          : await image.jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toBuffer();
    const outMime = `image/${target}`;
    return { buffer: output, mimeType: outMime, extension: EXTENSION[outMime]! };
  } catch {
    throw new UploadRejection('This image appears to be damaged and could not be read.');
  }
}
