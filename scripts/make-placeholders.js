/* eslint-env node */
// Generates solid-color PNG placeholders for the app icon assets.
// Run once: node scripts/make-placeholders.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

// size x size solid PNG in RGB
function solidPng(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  // raw scanlines: filter byte 0 + RGB per pixel
  const raw = Buffer.alloc(size * (1 + size * 3));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      // Simple chat-bubble: rounded square in indigo on transparent-ish bg
      raw[o++] = rgb[0];
      raw[o++] = rgb[1];
      raw[o++] = rgb[2];
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, '..', 'assets', 'images');
fs.mkdirSync(outDir, { recursive: true });

const INDIGO = [0x63, 0x66, 0xf1];
const WHITE = [0xff, 0xff, 0xff];

const targets = [
  ['icon.png', 1024, INDIGO],
  ['adaptive-icon.png', 1024, INDIGO],
  ['splash.png', 512, WHITE],
  ['favicon.png', 48, INDIGO],
];

for (const [name, size, rgb] of targets) {
  const p = path.join(outDir, name);
  fs.writeFileSync(p, solidPng(size, rgb));
  console.log('wrote', p, `${size}x${size}`);
}
