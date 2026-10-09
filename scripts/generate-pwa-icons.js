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

// 4. Clean transparent master extractor
function extractCleanTransparent(src) {
  const clean = Buffer.alloc(src.width * src.height * 4);
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const idx = (y * src.width + x) * 4;
      // Strip 'ĐÀ LẠT - VIỆT NAM' (y >= 390)
      if (y >= 390) {
        clean[idx] = 0; clean[idx + 1] = 0; clean[idx + 2] = 0; clean[idx + 3] = 0;
        continue;
      }
      const r = src.data[idx];
      const g = src.data[idx + 1];
      const b = src.data[idx + 2];
      const minVal = Math.min(r, g, b);
      const sat = Math.max(r, g, b) - minVal;

      // Pure background: bright warm off-white
      if (minVal >= 237 && sat <= 8) {
        clean[idx] = 0; clean[idx + 1] = 0; clean[idx + 2] = 0; clean[idx + 3] = 0;
      } else if (minVal >= 218 && sat <= 20) {
        // Transition anti-aliased edge
        const dMin = Math.max(0, 238 - minVal);
        const dSat = Math.max(0, sat - 7);
        const edgeFactor = Math.min(1.0, Math.max(dMin / 16, dSat / 10));
        const alpha = Math.round(edgeFactor * 255);
        if (alpha <= 10) {
          clean[idx] = 0; clean[idx + 1] = 0; clean[idx + 2] = 0; clean[idx + 3] = 0;
        } else {
          const aNorm = alpha / 255;
          const bgRef = 248;
          clean[idx] = Math.min(255, Math.max(0, Math.round((r - (1 - aNorm) * bgRef) / aNorm)));
          clean[idx + 1] = Math.min(255, Math.max(0, Math.round((g - (1 - aNorm) * bgRef) / aNorm)));
          clean[idx + 2] = Math.min(255, Math.max(0, Math.round((b - (1 - aNorm) * bgRef) / aNorm)));
          clean[idx + 3] = alpha;
        }
      } else {
        clean[idx] = r;
        clean[idx + 1] = g;
        clean[idx + 2] = b;
        clean[idx + 3] = 255;
      }
    }
  }
  return clean;
}

// 5. Crop transparent square region
function cropTransparent(srcData, srcW, srcH, cx, cy, size, padFraction = 0.12) {
  const half = Math.round(size / 2 * (1 + padFraction));
  const fullSize = half * 2;
  const out = Buffer.alloc(fullSize * fullSize * 4); // all 0 (transparent)

  const startX = cx - half;
  const startY = cy - half;

  for (let y = 0; y < fullSize; y++) {
    const sy = startY + y;
    if (sy < 0 || sy >= srcH) continue;
    for (let x = 0; x < fullSize; x++) {
      const sx = startX + x;
      if (sx < 0 || sx >= srcW) continue;
      const srcIdx = (sy * srcW + sx) * 4;
      const dstIdx = (y * fullSize + x) * 4;
      out[dstIdx] = srcData[srcIdx];
      out[dstIdx + 1] = srcData[srcIdx + 1];
      out[dstIdx + 2] = srcData[srcIdx + 2];
      out[dstIdx + 3] = srcData[srcIdx + 3];
    }
  }
  return { data: out, size: fullSize };
}

// 6. Composite transparent buffer on solid background (default pure white #ffffff)
function compositeOnSolid(transBuf, size, bgR = 255, bgG = 255, bgB = 255) {
  const out = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const idx = i * 4;
    const a = transBuf[idx + 3] / 255;
    const r = transBuf[idx];
    const g = transBuf[idx + 1];
    const b = transBuf[idx + 2];
    out[idx] = Math.round(r * a + bgR * (1 - a));
    out[idx + 1] = Math.round(g * a + bgG * (1 - a));
    out[idx + 2] = Math.round(b * a + bgB * (1 - a));
    out[idx + 3] = 255;
  }
  return out;
}

// Main generation
const masterBuf = readFileSync(new URL('../public/logo-original.png', import.meta.url));
const master = decodePNG(masterBuf);
const cleanMaster = extractCleanTransparent(master);

// 1. Transparent Emblem: Mountains + Diamond only (bounds x: 396..627, y: 144..270)
// Center at (512, 207), size = 236, pad = 0.12 -> 100% transparent PNG
const emblemCrop = cropTransparent(cleanMaster, master.width, master.height, 512, 207, 236, 0.12);
const emblem512 = resizeBilinear(emblemCrop.data, emblemCrop.size, emblemCrop.size, 512, 512);
const emblem512Png = encodePNG(emblem512, 512, 512);
writeFileSync(new URL('../public/logo-emblem.png', import.meta.url), emblem512Png);

// 2. Transparent Full Logo: Mountains + Diamond + KHÁCH SẠN + SƠN NGỌC (bounds x: 344..680, y: 144..387)
// Retaining dot under NGỌC (y=379..386), removing ĐÀ LẠT - VIỆT NAM (y >= 390)
const fullCrop = cropTransparent(cleanMaster, master.width, master.height, 512, 266, 338, 0.12);
const full512 = resizeBilinear(fullCrop.data, fullCrop.size, fullCrop.size, 512, 512);
const full512Png = encodePNG(full512, 512, 512);
writeFileSync(new URL('../public/logo-full.png', import.meta.url), full512Png);

// 3. PWA & Web App Icons on pure bright white #ffffff background
const pwa512Solid = compositeOnSolid(full512, 512, 255, 255, 255);
const pwa512Png = encodePNG(pwa512Solid, 512, 512);
writeFileSync(new URL('../public/pwa-512x512.png', import.meta.url), pwa512Png);

const pwa192 = resizeBilinear(pwa512Solid, 512, 512, 192, 192);
writeFileSync(new URL('../public/pwa-192x192.png', import.meta.url), encodePNG(pwa192, 192, 192));

// Apple Touch Icons on pure white #ffffff
const apple180 = resizeBilinear(pwa512Solid, 512, 512, 180, 180);
writeFileSync(new URL('../public/apple-touch-icon.png', import.meta.url), encodePNG(apple180, 180, 180));

const apple167 = resizeBilinear(pwa512Solid, 512, 512, 167, 167);
writeFileSync(new URL('../public/apple-touch-icon-167.png', import.meta.url), encodePNG(apple167, 167, 167));

const apple152 = resizeBilinear(pwa512Solid, 512, 512, 152, 152);
writeFileSync(new URL('../public/apple-touch-icon-152.png', import.meta.url), encodePNG(apple152, 152, 152));

// 4. PWA Maskable Icon on pure white with 42% safe padding for circular launcher masks
const maskableCrop = cropTransparent(cleanMaster, master.width, master.height, 512, 266, 338, 0.42);
const maskable512Trans = resizeBilinear(maskableCrop.data, maskableCrop.size, maskableCrop.size, 512, 512);
const maskable512Solid = compositeOnSolid(maskable512Trans, 512, 255, 255, 255);
writeFileSync(new URL('../public/pwa-maskable-512x512.png', import.meta.url), encodePNG(maskable512Solid, 512, 512));

// 5. Favicon (32x32) transparent emblem
const favCrop = cropTransparent(cleanMaster, master.width, master.height, 512, 207, 236, 0.06);
const fav32 = resizeBilinear(favCrop.data, favCrop.size, favCrop.size, 32, 32);
const png32 = encodePNG(fav32, 32, 32);
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

// 6. SVG Icon: Pure white squircle with subtle luxury champagne gold border
const b64 = pwa512Png.toString('base64');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <clipPath id="squircle">
      <rect width="512" height="512" rx="108" />
    </clipPath>
  </defs>
  <g clip-path="url(#squircle)">
    <rect width="512" height="512" fill="#ffffff" />
    <image href="data:image/png;base64,${b64}" x="0" y="0" width="512" height="512" preserveAspectRatio="xMidYMid meet" />
    <!-- Subtle luxury champagne gold border -->
    <rect x="2" y="2" width="508" height="508" rx="106" fill="none" stroke="#caa55e" stroke-width="2.5" stroke-opacity="0.4" />
  </g>
</svg>
`;
writeFileSync(new URL('../public/icon.svg', import.meta.url), svg);

console.log('Generated transparent logos and pure white app icons from public/logo-original.png');
