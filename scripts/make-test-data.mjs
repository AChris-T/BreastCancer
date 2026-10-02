// Generates synthetic pathology reports for testing BreastScan AI.
//   node scripts/make-test-data.mjs
// Output: test-data/*.png (+ one PDF). Every file is marked as synthetic;
// none of it describes a real patient.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'apps/api/package.json'));
const sharp = require('sharp');
const out = join(root, 'test-data');
mkdirSync(out, { recursive: true });

export const CASES = [
  {
    id: 'TEST-001', age: 52, year: 2025, site: 'Left breast', grade: 'I', score: 5,
    diagnosis: 'Invasive ductal carcinoma (NST)', er: 'Positive, 90% strong', pr: 'Positive, 60% moderate-strong',
    her2: 'Negative (IHC score 0)', ki67: '10%', size: '14 mm',
  },
  {
    id: 'TEST-002', age: 39, year: 2025, site: 'Left breast', grade: 'II', score: 6,
    diagnosis: 'Invasive mammary carcinoma', er: 'Positive, 30% moderate', pr: 'Negative (0%)',
    her2: 'Negative (IHC score 0)', ki67: 'Not performed', size: '22 mm',
  },
  {
    id: 'TEST-003', age: 47, year: 2025, site: 'Right breast', grade: 'III', score: 8,
    diagnosis: 'Invasive ductal carcinoma (NST)', er: 'Positive, 70% strong', pr: 'Positive, 20% weak-moderate',
    her2: 'Positive (IHC score 3+, complete intense membrane staining in >10% of cells)', ki67: '35%', size: '31 mm',
  },
  {
    id: 'TEST-004', age: 58, year: 2024, site: 'Right breast', grade: 'III', score: 9,
    diagnosis: 'Invasive ductal carcinoma (NST)', er: 'Negative (0%)', pr: 'Negative (0%)',
    her2: 'Positive (IHC score 3+)', ki67: '40%', size: '28 mm',
  },
  {
    id: 'TEST-005', age: 43, year: 2024, site: 'Left breast', grade: 'III', score: 8,
    diagnosis: 'Invasive carcinoma of no special type', er: 'Negative (0%)', pr: 'Negative (0%)',
    her2: 'Low (IHC score 1+, faint incomplete membrane staining)', ki67: '70%', size: '35 mm',
  },
  {
    id: 'TEST-006', age: 64, year: 2025, site: 'Left breast', grade: 'II', score: 7,
    diagnosis: 'Invasive ductal carcinoma (NST)', er: 'Positive, 80% strong', pr: 'Positive, 50% moderate',
    her2: 'Positive (IHC score 3+)', ki67: '25%', size: '19 mm',
  },
  {
    id: 'TEST-007', age: 68, year: 2025, site: 'Right breast', grade: 'II', score: 6,
    diagnosis: 'Invasive lobular carcinoma', er: 'Positive, 80% strong', pr: 'Positive, 50% moderate',
    her2: 'Negative (IHC score 0)', ki67: 'Not performed', size: '17 mm',
  },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function wrap(text, max) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max) {
      lines.push(line.trim());
      line = w;
    } else line += ' ' + w;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

function reportSvg(c) {
  const W = 1240;
  const H = 1754;
  let y = 0;
  const parts = [];
  const text = (x, size, value, opts = '') => {
    parts.push(`<text x="${x}" y="${y}" font-size="${size}" ${opts}>${esc(value)}</text>`);
  };
  const line = () => parts.push(`<line x1="80" y1="${y}" x2="${W - 80}" y2="${y}" stroke="#999" stroke-width="2"/>`);

  y = 70;
  parts.push(`<rect x="0" y="0" width="${W}" height="110" fill="#fdecec"/>`);
  text(W / 2, 34, 'SYNTHETIC TEST REPORT - NOT A REAL PATIENT', 'text-anchor="middle" font-weight="bold" fill="#c53030"');
  y = 175;
  text(80, 40, 'DEPARTMENT OF HISTOPATHOLOGY', 'font-weight="bold"');
  y += 44;
  text(80, 26, 'Teaching Hospital Test Laboratory  |  Surgical Pathology Report', 'fill="#444"');
  y += 30;
  line();

  y += 50;
  const meta = [
    ['Lab number', c.id],
    ['Age', `${c.age} years`],
    ['Sex', 'Female'],
    ['Year of diagnosis', String(c.year)],
    ['Specimen', `${c.site}, core needle biopsy`],
  ];
  for (const [k, v] of meta) {
    text(80, 28, `${k}:`, 'font-weight="bold"');
    text(400, 28, v);
    y += 42;
  }
  y += 10;
  line();

  y += 55;
  text(80, 30, 'MICROSCOPY', 'font-weight="bold"');
  y += 44;
  const micro = `Sections show an infiltrating carcinoma measuring ${c.size} in the largest dimension on imaging correlation. Nottingham grade ${c.grade} (score ${c.score}/9).`;
  for (const l of wrap(micro, 70)) {
    text(80, 27, l);
    y += 38;
  }

  y += 30;
  text(80, 30, 'IMMUNOHISTOCHEMISTRY', 'font-weight="bold"');
  y += 22;
  const rows = [
    ['Oestrogen receptor (ER)', c.er],
    ['Progesterone receptor (PR)', c.pr],
    ['HER2', c.her2],
    ['Ki-67 proliferation index', c.ki67],
  ];
  for (const [k, v] of rows) {
    const vLines = wrap(v, 38);
    const h = 26 + vLines.length * 36;
    parts.push(`<rect x="80" y="${y}" width="${W - 160}" height="${h}" fill="none" stroke="#bbb" stroke-width="2"/>`);
    parts.push(`<line x1="520" y1="${y}" x2="520" y2="${y + h}" stroke="#bbb" stroke-width="2"/>`);
    const top = y;
    y = top + 44;
    text(100, 27, k, 'font-weight="bold"');
    for (const vl of vLines) {
      text(545, 27, vl);
      y += 36;
    }
    y = top + h;
  }

  y += 60;
  text(80, 30, 'DIAGNOSIS', 'font-weight="bold"');
  y += 46;
  for (const l of wrap(`${c.site.toUpperCase()}, CORE BIOPSY: ${c.diagnosis.toUpperCase()}, GRADE ${c.grade}.`, 60)) {
    text(80, 28, l, 'font-weight="bold"');
    y += 40;
  }

  y = H - 130;
  line();
  y += 45;
  text(80, 24, 'Reported by: Dr A. Test (Consultant Histopathologist) - fictitious signatory', 'fill="#444"');
  y += 40;
  text(80, 22, 'Synthetic document generated for software testing. Contains no real patient data.', 'fill="#c53030"');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Arial, Helvetica, sans-serif" fill="#111">
<rect width="100%" height="100%" fill="#ffffff"/>${parts.join('\n')}</svg>`;
}

function unrelatedSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700" font-family="Arial, Helvetica, sans-serif">
<rect width="100%" height="100%" fill="#fff8e7"/>
<text x="80" y="120" font-size="56" font-weight="bold" fill="#5a3e1b">Market list</text>
${['5 tubers of yam', '2 kg rice', 'Tomatoes and peppers', 'Palm oil (1 litre)', 'Bread', 'Sachet water x 20']
  .map((t, i) => `<text x="110" y="${220 + i * 70}" font-size="40" fill="#333">- ${t}</text>`)
  .join('\n')}
</svg>`;
}

for (const c of CASES) {
  await sharp(Buffer.from(reportSvg(c))).png().toFile(join(out, `${c.id}-report.png`));
}
await sharp(Buffer.from(unrelatedSvg())).png().toFile(join(out, 'TEST-008-unrelated.png'));
// One PDF version, to test the PDF upload path.
{
  const png = await sharp(Buffer.from(reportSvg(CASES[2]))).png().toBuffer();
  const { Document, Page, Image, renderToBuffer } = await import('@react-pdf/renderer').catch(() => require('@react-pdf/renderer'));
  const { createElement: h } = require('react');
  const pdf = await renderToBuffer(
    h(Document, null, h(Page, { size: 'A4', style: { padding: 0 } }, h(Image, { src: { data: png, format: 'png' }, style: { width: 590, height: 834, margin: 2 } }))),
  );
  writeFileSync(join(out, 'TEST-003-report.pdf'), pdf);
}
console.log(`Wrote ${CASES.length + 2} files to ${out}`);
