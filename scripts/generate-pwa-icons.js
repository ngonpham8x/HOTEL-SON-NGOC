import { readFileSync, writeFileSync } from 'node:fs';
import zlib from 'node:zlib';

// 1. Decode PNG into raw RGBA buffer
function decodePNG(buf) {
  let offset = 8;
  const idatChunks = [];
  let width = 0, height = 0;
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    if (type === 'IHDR') {
      width = buf.readUInt32BE(offset + 8);
      height = buf.readUInt32BE(offset + 12);
    } else if (type === 'IDAT') {
      idatChunks.push(buf.subarray(offset + 8, offset + 8 + length));
    }
    offset += 12 + length;
  }
  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const stride = 1 + width * 4;
  const uncompressed = Buffer.alloc(width * height * 4);

  function paethPredictor(a, b, c) {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  }

  for (let y = 0; y < height; y++) {
    const filter = raw[y * stride];
    const rowStart = y * stride + 1;
    const outRowStart = y * width * 4;
    const prevOutRowStart = (y - 1) * width * 4;
    for (let x = 0; x < width * 4; x++) {
      const rawVal = raw[rowStart + x];
      const a = x >= 4 ? uncompressed[outRowStart + x - 4] : 0;
      const b = y > 0 ? uncompressed[prevOutRowStart + x] : 0;
      const c = (x >= 4 && y > 0) ? uncompressed[prevOutRowStart + x - 4] : 0;
      let val = 0;
      if (filter === 0) val = rawVal;
      else if (filter === 1) val = (rawVal + a) & 0xff;
      else if (filter === 2) val = (rawVal + b) & 0xff;
      else if (filter === 3) val = (rawVal + Math.floor((a + b) / 2)) & 0xff;
      else if (filter === 4) val = (rawVal + paethPredictor(a, b, c)) & 0xff;
      uncompressed[outRowStart + x] = val;
    }
  }
  return { data: uncompressed, width, height };
}

// 2. Encode raw RGBA buffer into PNG
function encodePNG(buf, w, h) {
  const stride = 1 + w * 4;
  const raw = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;
    buf.copy(raw, y * stride + 1, y * w * 4, (y + 1) * w * 4);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const crc32Table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1));
    crc32Table[i] = c;
  }
  function crc32(b, start, len) {
    let c = 0xffffffff;
    for (let i = 0; i < len; i++) c = crc32Table[(c ^ b[start + i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const chunk = Buffer.alloc(12 + data.length);
    chunk.writeUInt32BE(data.length, 0);
    chunk.write(type, 4, 4, 'ascii');
    data.copy(chunk, 8);
    const crcVal = crc32(chunk, 4, 4 + data.length);
    chunk.writeUInt32BE(crcVal, 8 + data.length);
    return chunk;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

// 3. Bilinear image resizer
function resizeBilinear(srcBuf, srcW, srcH, dstW, dstH) {
  const dstBuf = Buffer.alloc(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const gx = x * xRatio;
      const gy = y * yRatio;
      const gxi = Math.floor(gx);
      const gyi = Math.floor(gy);
      const dx = gx - gxi;
      const dy = gy - gyi;

      const x0 = Math.min(gxi, srcW - 1);
      const x1 = Math.min(gxi + 1, srcW - 1);
      const y0 = Math.min(gyi, srcH - 1);
      const y1 = Math.min(gyi + 1, srcH - 1);

      const p00 = (y0 * srcW + x0) * 4;
      const p10 = (y0 * srcW + x1) * 4;
      const p01 = (y1 * srcW + x0) * 4;
      const p11 = (y1 * srcW + x1) * 4;

      const dstIdx = (y * dstW + x) * 4;
      for (let c = 0; c < 4; c++) {
        const val = (1 - dx) * (1 - dy) * srcBuf[p00 + c] +
                    dx * (1 - dy) * srcBuf[p10 + c] +
                    (1 - dx) * dy * srcBuf[p01 + c] +
                    dx * dy * srcBuf[p11 + c];
        dstBuf[dstIdx + c] = Math.round(val);
      }
    }
  }
  return dstBuf;
}

// 4. Crop region with background fill
function cropSquare(src, cx, cy, size, padFraction = 0.12, maxYCut = 9999, bgR = 248, bgG = 247, bgB = 243) {
  const half = Math.round(size / 2 * (1 + padFraction));
  const fullSize = half * 2;
  const out = Buffer.alloc(fullSize * fullSize * 4);

  for (let i = 0; i < fullSize * fullSize; i++) {
    out[i * 4] = bgR;
    out[i * 4 + 1] = bgG;
    out[i * 4 + 2] = bgB;
    out[i * 4 + 3] = 255;
  }

  const startX = cx - half;
  const startY = cy - half;

  for (let y = 0; y < fullSize; y++) {
    const sy = startY + y;
    if (sy < 0 || sy >= src.height || sy >= maxYCut) continue;
    for (let x = 0; x < fullSize; x++) {
      const sx = startX + x;
      if (sx < 0 || sx >= src.width) continue;
      const srcIdx = (sy * src.width + sx) * 4;
      const dstIdx = (y * fullSize + x) * 4;
      out[dstIdx] = src.data[srcIdx];
      out[dstIdx + 1] = src.data[srcIdx + 1];
      out[dstIdx + 2] = src.data[srcIdx + 2];
      out[dstIdx + 3] = src.data[srcIdx + 3];
    }
  }
  return { data: out, size: fullSize };
}

// Main generation
const masterBuf = readFileSync(new URL('../public/logo-original.png', import.meta.url));
const master = decodePNG(masterBuf);

// 1. Full logo square: Centered at (512, 260), removing "ĐÀ LẠT - VIỆT NAM" (maxYCut = 377).
const fullCropped = cropSquare(master, 512, 260, 336, 0.18, 377);
const square512 = resizeBilinear(fullCropped.data, fullCropped.size, fullCropped.size, 512, 512);
const square512Png = encodePNG(square512, 512, 512);

writeFileSync(new URL('../public/logo-full.png', import.meta.url), square512Png);
writeFileSync(new URL('../public/pwa-512x512.png', import.meta.url), square512Png);

const square192 = resizeBilinear(fullCropped.data, fullCropped.size, fullCropped.size, 192, 192);
writeFileSync(new URL('../public/pwa-192x192.png', import.meta.url), encodePNG(square192, 192, 192));

const apple180 = resizeBilinear(fullCropped.data, fullCropped.size, fullCropped.size, 180, 180);
writeFileSync(new URL('../public/apple-touch-icon.png', import.meta.url), encodePNG(apple180, 180, 180));

const apple167 = resizeBilinear(fullCropped.data, fullCropped.size, fullCropped.size, 167, 167);
writeFileSync(new URL('../public/apple-touch-icon-167.png', import.meta.url), encodePNG(apple167, 167, 167));

const apple152 = resizeBilinear(fullCropped.data, fullCropped.size, fullCropped.size, 152, 152);
writeFileSync(new URL('../public/apple-touch-icon-152.png', import.meta.url), encodePNG(apple152, 152, 152));

// 2. Maskable icon with 42% padding for safe circle cropping, removing "ĐÀ LẠT - VIỆT NAM"
const maskableCropped = cropSquare(master, 512, 260, 336, 0.42, 377);
const maskable512 = resizeBilinear(maskableCropped.data, maskableCropped.size, maskableCropped.size, 512, 512);
writeFileSync(new URL('../public/pwa-maskable-512x512.png', import.meta.url), encodePNG(maskable512, 512, 512));

// 3. Emblem crop: Mountains + Emerald Diamond only
const emblemCropped = cropSquare(master, 512, 208, 232, 0.16, 276);
const emblem512 = resizeBilinear(emblemCropped.data, emblemCropped.size, emblemCropped.size, 512, 512);
const emblem512Png = encodePNG(emblem512, 512, 512);
writeFileSync(new URL('../public/logo-emblem.png', import.meta.url), emblem512Png);

// 4. Favicon (32x32) focusing on the crisp emblem
const favicon32 = resizeBilinear(emblemCropped.data, emblemCropped.size, emblemCropped.size, 32, 32);
const png32 = encodePNG(favicon32, 32, 32);
const icoHeader = Buffer.alloc(22);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(1, 4);
icoHeader[6] = 32;
icoHeader[7] = 32;
icoHeader.writeUInt16LE(1, 10);
icoHeader.writeUInt16LE(32, 12);
icoHeader.writeUInt32LE(png32.length, 14);
icoHeader.writeUInt32LE(22, 18);
writeFileSync(new URL('../public/favicon.ico', import.meta.url), Buffer.concat([icoHeader, png32]));

// 5. SVG icon: Embedded high-resolution official logo
const b64 = square512Png.toString('base64');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <clipPath id="squircle">
      <rect width="512" height="512" rx="108" />
    </clipPath>
  </defs>
  <g clip-path="url(#squircle)">
    <rect width="512" height="512" fill="#f8f7f2" />
    <image href="data:image/png;base64,${b64}" x="0" y="0" width="512" height="512" preserveAspectRatio="xMidYMid meet" />
    <!-- Subtle luxury champagne gold border -->
    <rect x="2" y="2" width="508" height="508" rx="106" fill="none" stroke="#caa55e" stroke-width="3" stroke-opacity="0.4" />
  </g>
</svg>
`;
writeFileSync(new URL('../public/icon.svg', import.meta.url), svg);

console.log('Generated matching official app icons and icon.svg from public/logo-original.png');
