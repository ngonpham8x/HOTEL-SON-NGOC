import { copyFileSync, mkdirSync } from 'node:fs';
import { createBrowserCLI } from './browser-cli.mjs';
import { loginBrowser } from './browser-auth.mjs';
import assert from 'node:assert/strict';
mkdirSync('.review', {recursive:true});
const run = createBrowserCLI('sonngoc-production-review');
const evaluate = js => run('eval',js);
const check = (js,message) => { assert.equal(evaluate(`(async()=>Boolean(${js}))()`),'true',message); console.log('PASS',message); };
const settle = () => run('wait','500');
const screenshot = name => { const output=run('screenshot',name); const path=output.match(/Screenshot saved to (.+)/)?.[1]?.trim(); if(path)copyFileSync(path,name); };
run('set','offline','off');
run('set','viewport','320','740');
run('open','http://127.0.0.1:4173');settle();
evaluate(`(async()=>{await Promise.all((await navigator.serviceWorker.getRegistrations()).map(r=>r.unregister()));await Promise.all((await caches.keys()).filter(k=>k.startsWith('son-ngoc-')).map(k=>caches.delete(k)));return true})()`);
run('reload');settle();
loginBrowser(run);
evaluate(`window.__qaErrors=[];addEventListener('error',e=>window.__qaErrors.push(e.message));`);
evaluate(`navigator.serviceWorker.ready.then(reg=>reg.scope)`);
check(`document.body.innerText.includes('Hotel Sơn Ngọc') && !document.querySelector('vite-error-overlay')`,'production app loads');
check(`document.documentElement.scrollWidth===innerWidth`,'production homepage fits a 320px viewport');
check(`Array.from(document.querySelectorAll('button')).every(e=>!e.textContent.includes('Khôi phục dữ liệu mẫu'))`,'sample reset button is absent');
run('set','offline','on');
try {
  run('reload');settle();
  evaluate(`window.__qaErrors=[];addEventListener('error',e=>window.__qaErrors.push(e.message));`);
  check(`document.querySelector('main')?.innerText.includes('Doanh thu')`,'production app opens offline');
  check(`await (async()=>{for(const src of ['/icon.svg','/pwa-192x192.png','/pwa-512x512.png','/pwa-maskable-512x512.png','/apple-touch-icon.png','/apple-touch-icon-152.png','/apple-touch-icon-167.png']){const image=new Image();image.src=src;await image.decode();if(!image.naturalWidth)return false;}return true})()`, 'all phone, tablet and desktop logo assets are available offline');
  for (const label of ['Bảng giá','Thống kê','Xuất Excel']) {
    evaluate(`document.querySelector('button[aria-label="Ẩn hiện menu"]').click()`);settle();
    evaluate(`Array.from(document.querySelectorAll('aside nav button')).find(e=>e.textContent.includes(${JSON.stringify(label)})).click()`);settle();
    check(`!document.body.innerText.includes('Đang mở trang') && document.querySelector('main').innerText.length>200`,'offline navigation: '+label);
  }
  evaluate(`document.querySelector('.report-sheet').scrollIntoView(); window.scrollBy(0,-64)`);settle();
  check(`document.documentElement.scrollWidth===innerWidth && Array.from(document.querySelectorAll('.report-financial td')).every(e=>e.getBoundingClientRect().right<=innerWidth)`,'financial report amounts fit within the mobile viewport');
  screenshot('.review/production-report-320.png');
  check(`!document.querySelector('.report-sheet').textContent.includes('Nguyễn Thu Thủy') && !document.querySelector('.report-sheet').textContent.includes('Trần Hoàng Long')`,'report signature names are removed');
  check(`window.__qaErrors.length===0`,'production offline navigation has no runtime errors');
  evaluate(`document.querySelector('button[aria-label="Ẩn hiện menu"]').click()`);settle();
  run('click', 'aside button[aria-label="Đăng xuất"]');settle();
  run('reload');settle();
  check(`document.getElementById('login-password') && !document.querySelector('header')`, 'offline app requires login after logout');
  loginBrowser(run);
  check(`document.querySelector('header')`, 'password verification and dashboard work offline');
} finally { run('set','offline','off'); }
console.log('Production and offline checks passed.');
