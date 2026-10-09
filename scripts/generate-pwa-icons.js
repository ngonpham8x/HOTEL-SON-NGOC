import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

// Render each app/browser icon from the same source as HotelLogo.
const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
const render = (size, maskable = false) => {
  const source = maskable ? `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#04262d"/><svg x="76" y="76" width="360" height="360" viewBox="0 0 512 512">${svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</svg></svg>` : svg;
  return new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng();
};
for (const [name, size, maskable] of [['pwa-192x192.png',192],['pwa-512x512.png',512],['pwa-maskable-512x512.png',512,true],['apple-touch-icon.png',180],['apple-touch-icon-152.png',152],['apple-touch-icon-167.png',167]]) {
  writeFileSync(new URL(`../public/${name}`, import.meta.url), render(size, maskable));
}
const png = render(32);
const header = Buffer.alloc(22);
header.writeUInt16LE(1,2); header.writeUInt16LE(1,4);
header[6] = 32; header[7] = 32; header.writeUInt16LE(1,10); header.writeUInt16LE(32,12);
header.writeUInt32LE(png.length,14); header.writeUInt32LE(22,18);
writeFileSync(new URL('../public/favicon.ico', import.meta.url), Buffer.concat([header,png]));
console.log('Generated matching app icons from public/icon.svg');
