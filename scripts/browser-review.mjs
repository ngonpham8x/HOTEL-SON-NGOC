import { mkdirSync, copyFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createBrowserCLI } from './browser-cli.mjs';
import { loginBrowser } from './browser-auth.mjs';
mkdirSync('.review', { recursive: true });
const browser = createBrowserCLI('sonngoc-mobile-review');
const run = (...args) => {
  const output = browser(...args);
  if (args[0] === 'screenshot') { const path = output.match(/Screenshot saved to (.+)/)?.[1]?.trim(); if (path) copyFileSync(path, args[1]); }
  console.log(args[0], output.slice(0, 3500)); return output;
};
const evaluate = js => run('eval', js);
const settle = () => run('wait', '500');
const clickText = (selector, text) => { evaluate(`Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find(e => e.textContent.includes(${JSON.stringify(text)}))?.click()`); settle(); };
const check = (js, message) => { assert.equal(evaluate(`Boolean(${js})`), 'true', message); console.log('PASS', message); };
const nav = text => { evaluate(`document.querySelector('button[aria-label="Ẩn hiện menu"]').click()`); settle(); clickText('aside nav button', text); };
const overflow = () => evaluate(`JSON.stringify({width: innerWidth, pageWidth: document.documentElement.scrollWidth, overflow: Array.from(document.querySelectorAll('main *, .room-dialog *, header *')).filter(e => { const r=e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1 && !e.closest('table') && !e.closest('[class*="overflow-x-auto"]'); }).slice(0,12).map(e => ({tag:e.tagName, text:e.textContent.slice(0,70),class:e.className}))})`);
run('close');
run('open', 'http://localhost:3000');
settle();
loginBrowser(run);
evaluate(`(async()=>{ const m=await import('/src/data/initialData.ts'); localStorage.setItem('son_ngoc_hotel_data_v3',JSON.stringify({version:3,data:{rooms:m.INITIAL_ROOMS,services:m.INITIAL_SERVICES,stays:m.INITIAL_STAYS,reservations:m.INITIAL_RESERVATIONS,invoices:m.INITIAL_INVOICES,debts:m.INITIAL_DEBTS}})); return true; })()`);
run('reload');settle();
run('errors', '--clear');
evaluate(`document.querySelector('vite-error-overlay') ? 'ERROR' : document.body.innerText.length`);
run('screenshot', '.review/desktop.png');
for (const width of [320, 375, 768]) {
  run('set', 'viewport', String(width), '740');
  overflow();
  check(`document.documentElement.scrollWidth === innerWidth`, `homepage fits ${width}px`);
  run('screenshot', `.review/home-${width}.png`);
}
run('set', 'viewport', '320', '740');
clickText('main button', 'N01');
overflow();
run('screenshot', '.review/room-320.png');
check(`document.querySelector('.room-dialog select').getBoundingClientRect().right <= innerWidth`, 'room service selector fits mobile');
check(`Array.from(document.querySelectorAll('.room-dialog-footer button')).every(e => { const r=e.getBoundingClientRect(); return r.right<=innerWidth && r.bottom<=innerHeight && r.height<=60; })`, 'room action buttons fit mobile');
evaluate(`const body=document.querySelector('.room-dialog > div > :nth-child(2)'); body.scrollTop=body.scrollHeight`);settle();
run('screenshot', '.review/room-services-320.png');
run('snapshot', '-i');
clickText('.room-dialog-footer button', 'Đóng');
evaluate(`document.querySelector('button[aria-label="Ẩn hiện menu"]').click()`);
settle();
run('screenshot', '.review/menu-320.png');
clickText('aside nav button', 'Đặt phòng');
overflow();
run('screenshot', '.review/reservations-320.png');
evaluate(`document.querySelector('button[aria-label="Ẩn hiện menu"]').click()`);
clickText('aside nav button', 'Bảng giá');
clickText('main button', 'Cấu hình giá phòng');
check(`document.querySelectorAll('main table').length === 2`, 'tariff and individual room pricing tables are present');
overflow();
run('screenshot', '.review/tariff-320.png');
clickText('main button', 'Dạng bảng');
check(`document.querySelectorAll('main .mobile-table-wide').length === 2 && document.documentElement.scrollWidth===innerWidth`, 'both tariff tables scroll within their containers');
run('screenshot', '.review/tariff-table-320.png');
evaluate(`document.querySelector('button[aria-label="Ẩn hiện menu"]').click()`);
clickText('aside nav button', 'Xuất Excel');
overflow();
run('screenshot', '.review/report-320.png');
for (const label of ['Sơ đồ phòng', 'Khách đang ở', 'Quản lý công nợ', 'Thống kê doanh thu']) {
  nav(label);
  overflow();
  check(`document.documentElement.scrollWidth === innerWidth`, `mobile page fits: ${label}`);
  if (label === 'Sơ đồ phòng') check(`Array.from(document.querySelectorAll('main button')).filter(e=>e.textContent.includes('Thêm phòng')).every(e=>e.getBoundingClientRect().right<=innerWidth)`, 'add-room button is fully visible');
  if (label === 'Thống kê doanh thu') {
    check(`Array.from(document.querySelectorAll('main .overflow-x-auto')).some(e=>e.scrollWidth>e.clientWidth)`, 'monthly chart can be swiped horizontally');
    clickText('main button', 'Thống kê theo ngày');
    check(`document.documentElement.scrollWidth===innerWidth && Array.from(document.querySelectorAll('main .overflow-x-auto')).some(e=>e.scrollWidth>e.clientWidth)`, 'daily chart can be swiped without expanding the page');
  }
}
assert.equal(run('errors'), '', 'browser has no runtime errors');
console.log('All mobile layout checks passed.');
