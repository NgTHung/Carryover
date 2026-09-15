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

function receiptPixel(x, y) {
  const paper = x >= 150 && x < 1050 && y >= 90 && y < 1710;
  if (!paper) return [224, 219, 207, 255];
  const edge = x === 150 || x === 1049 || y === 90 || y === 1709;
  if (edge) return [52, 60, 57, 255];
  if (y > 220 && y < 300 && x > 260 && x < 930) return [32, 82, 69, 255];
  const row = Math.floor((y - 360) / 74);
  const lineY = (y - 360) % 74;
  const lineWidth = 190 + ((row * 97) % 470);
  if (row >= 0 && row < 15 && lineY >= 8 && lineY < 18 && x >= 250 && x < 250 + lineWidth) {
    return [50, 57, 54, 255];
  }
  if (row >= 0 && row < 15 && lineY >= 27 && lineY < 35 && x >= 250 && x < 250 + Math.floor(lineWidth * 0.55)) {
    return [143, 148, 140, 255];
  }
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
