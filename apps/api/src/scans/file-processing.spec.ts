import sharp from 'sharp';
import { detectMime, isEncryptedPdf, sanitise, UploadRejection } from './file-processing.js';

const pdf = (extra = '') =>
  Buffer.from(`%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R ${extra}>>\n%%EOF`, 'latin1');

describe('detectMime', () => {
  it('identifies files by signature, not name', async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#000' } }).png().toBuffer();
    expect(await detectMime(png)).toBe('image/png');
    expect(await detectMime(pdf())).toBe('application/pdf');
  });

  it('rejects unsupported and empty files', async () => {
    await expect(detectMime(Buffer.from('MZ\x90\x00 not an image'))).rejects.toBeInstanceOf(UploadRejection);
    await expect(detectMime(Buffer.alloc(0))).rejects.toBeInstanceOf(UploadRejection);
  });
});

describe('isEncryptedPdf', () => {
  it('detects an /Encrypt trailer entry', () => {
    expect(isEncryptedPdf(pdf('/Encrypt 5 0 R '))).toBe(true);
    expect(isEncryptedPdf(pdf())).toBe(false);
  });
});

describe('sanitise', () => {
  it('strips EXIF and GPS data from JPEGs', async () => {
    const withExif = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#777' } })
      .jpeg()
      .withExif({ IFD0: { Make: 'TestCam' }, IFD3: { GPSLatitudeRef: 'N' } })
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const clean = await sanitise(withExif, 'image/jpeg');
    expect(clean.mimeType).toBe('image/jpeg');
    expect((await sharp(clean.buffer).metadata()).exif).toBeUndefined();
  });

  it('keeps PDFs unchanged', async () => {
    const input = pdf();
    const out = await sanitise(input, 'application/pdf');
    expect(out.buffer.equals(input)).toBe(true);
  });

  it('rejects images that cannot be decoded', async () => {
    const broken = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
    await expect(sanitise(broken, 'image/jpeg')).rejects.toBeInstanceOf(UploadRejection);
  });
});
