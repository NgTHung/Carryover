/**
 * Generates deterministic, nonpersonal images for the development capture
 * probe. The fixture set gives the device check varied dimensions and light
 * levels without putting camera access or personal photos in the repository.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const outputDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'assets',
  'photo-fixtures'
);

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 0 ? value >>> 1 : (value >>> 1) ^ 0xedb88320;
  }
  return value >>> 0;
});

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function createPng(width, height, pixelAt) {
  const rows = Buffer.alloc(height * (width * 4 + 1));
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    rows[offset] = 0;
    offset += 1;
    for (let x = 0; x < width; x += 1) {
      const pixel = pixelAt(x, y);
      rows[offset] = pixel[0];
      rows[offset + 1] = pixel[1];
      rows[offset + 2] = pixel[2];
      rows[offset + 3] = pixel[3];
      offset += 4;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(rows, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

const receiptGlyphs = {
  '0': '111101101101111',
  '1': '010110010010111',
  '2': '111001111100111',
  '3': '111001111001111',
  '4': '101101111001001',
  '5': '111100111001111',
  '6': '111100111101111',
  '9': '111101111001111',
  A: '010101111101101',
  C: '111100100100111',
  D: '110101101101110',
  E: '111100110100111',
  F: '111100110100100',
  H: '101101111101101',
  I: '111010010010111',
  K: '101101110101101',
  L: '100100100100111',
  M: '101111111101101',
  N: '101111111111101',
  O: '111101101101111',
  P: '110101110100100',
  R: '110101110101101',
  T: '111010010010010',
  U: '101101101101111',
  V: '101101101101010',
  Y: '101101010010010',
};

const receiptText = [
  { text: 'CARRYOVER RECEIPT', x: 250, y: 225, scale: 8 },
  { text: 'DATE 2026 09 15', x: 250, y: 390, scale: 5 },
  { text: 'COFFEE', x: 250, y: 560, scale: 5 },
  { text: '45000 VND', x: 650, y: 560, scale: 5 },
  { text: 'LUNCH', x: 250, y: 690, scale: 5 },
  { text: '65000 VND', x: 650, y: 690, scale: 5 },
  { text: 'MARKET', x: 250, y: 820, scale: 5 },
  { text: '123456 VND', x: 650, y: 820, scale: 5 },
  { text: 'TOTAL', x: 250, y: 1060, scale: 7 },
  { text: '233456 VND', x: 580, y: 1060, scale: 7 },
  { text: 'THANK YOU', x: 390, y: 1390, scale: 6 },
];

function textPixel({ text, x, y, scale }, pixelX, pixelY) {
  const relativeX = pixelX - x;
  const relativeY = pixelY - y;
  if (relativeX < 0 || relativeY < 0 || relativeY >= 5 * scale) return false;
  const characterIndex = Math.floor(relativeX / (4 * scale));
  if (characterIndex >= text.length) return false;
  const column = Math.floor((relativeX % (4 * scale)) / scale);
  if (column >= 3) return false;
  const glyph = receiptGlyphs[text[characterIndex]];
  if (glyph === undefined) return false;
  const row = Math.floor(relativeY / scale);
  return glyph[row * 3 + column] === '1';
}

function receiptPixel(x, y) {
  const paper = x >= 150 && x < 1050 && y >= 90 && y < 1710;
  if (!paper) return [224, 219, 207, 255];
  const edge = x === 150 || x === 1049 || y === 90 || y === 1709;
  if (edge) return [52, 60, 57, 255];
  if (receiptText.some((line) => textPixel(line, x, y))) return [42, 48, 45, 255];
  if (y >= 990 && y < 1000 && x >= 230 && x < 970) return [50, 57, 54, 255];
  if (y >= 1190 && y < 1200 && x >= 230 && x < 970) return [50, 57, 54, 255];
  return [250, 248, 240, 255];
}

function landscapePixel(x, y) {
  const sky = y < 680;
  const base = sky ? [77, 143, 165] : [188, 157, 105];
  const gradient = sky ? y / 680 : (y - 680) / 520;
  let red = clamp(base[0] + gradient * 40);
  let green = clamp(base[1] + gradient * 25);
  let blue = clamp(base[2] + gradient * 8);
  if (x > 150 && x < 580 && y > 420 && y < 1040) {
    red = 215;
    green = 71;
    blue = 51;
  }
  if (x > 760 && x < 1320 && y > 300 && y < 940) {
    red = 241;
    green = 193;
    blue = 62;
  }
  if (x > 1430 && x < 1710 && y > 500 && y < 1080) {
    red = 47;
    green = 89;
    blue = 75;
  }
  return [red, green, blue, 255];
}

function darkNoisyPixel(x, y) {
  let seed = (x * 1103515245 + y * 12345 + 0x2a5f1) >>> 0;
  seed = (seed ^ (seed >>> 16)) >>> 0;
  const noise = seed & 31;
  const line = y % 121 >= 8 && y % 121 < 14 && x > 160 && x < 1390;
  return line
    ? [150 + noise, 157 + noise, 143 + noise, 255]
    : [10 + noise, 13 + noise, 18 + noise, 255];
}

function detailedScenePixel(x, y) {
  if (y < 700) {
    return [clamp(38 + y / 10), clamp(103 + y / 8), clamp(150 + y / 18), 255];
  }
  const ground = [clamp(95 + y / 18), clamp(88 + y / 22), clamp(69 + y / 25)];
  if (x > 130 && x < 560 && y > 520 && y < 1120) return [198, 201, 191, 255];
  if (x > 700 && x < 1180 && y > 450 && y < 1020) return [193, 101, 53, 255];
  if (x > 1330 && x < 1840 && y > 580 && y < 1190) return [62, 91, 113, 255];
  if (x % 120 < 4 || y % 120 < 4) return [213, 188, 122, 255];
  return [...ground, 255];
}

function smallPixel(x, y) {
  const checker = (Math.floor(x / 24) + Math.floor(y / 24)) % 2 === 0;
  return checker ? [39, 113, 94, 255] : [231, 190, 79, 255];
}

mkdirSync(outputDirectory, { recursive: true });
writeFileSync(join(outputDirectory, 'portrait-receipt.png'), createPng(1200, 1800, receiptPixel));
writeFileSync(join(outputDirectory, 'landscape-purchase.png'), createPng(1800, 1200, landscapePixel));
writeFileSync(join(outputDirectory, 'dark-noisy.png'), createPng(1600, 1200, darkNoisyPixel));
writeFileSync(join(outputDirectory, 'detailed-scene.png'), createPng(2000, 1400, detailedScenePixel));
writeFileSync(join(outputDirectory, 'already-small.png'), createPng(240, 180, smallPixel));
