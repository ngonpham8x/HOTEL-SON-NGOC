import assert from 'node:assert/strict';
import { copyFileSync } from 'node:fs';
import { createBrowserCLI } from './browser-cli.mjs';

const run = createBrowserCLI('sonngoc-install-review');
const evaluate = js => run('eval', js);
const check = (js, label) => { assert.equal(evaluate(`(async()=>Boolean(${js}))()`), 'true', label); console.log('PASS', label); };
const guide = '[role="dialog"][aria-label="Hướng dẫn cài ứng dụng"]';
const install = 'button[aria-label="Cài ứng dụng"]';
const guides = 'button[aria-label="Hướng dẫn cài trên mọi thiết bị"]';
const device = 'select[aria-label="Thiết bị cài app"]';
const browser = 'select[aria-label="Trình duyệt cài app"]';
const close = 'button[aria-label="Đóng hướng dẫn cài ứng dụng"]';
const waitGuide = () => run('wait', '--fn', `!!document.querySelector(${JSON.stringify(guide)})`);
const closeGuide = () => { run('click', close); run('wait', '--fn', `!document.querySelector(${JSON.stringify(guide)})`); };
const screenshot = name => { const result = run('screenshot'); const path = result.match(/Screenshot saved to (.+)/)?.[1]?.trim(); if (path) copyFileSync(path, `.review/${name}.png`); };
const fits = () => check(`document.documentElement.scrollWidth===innerWidth && (()=>{const d=document.querySelector(${JSON.stringify(guide)}),r=d.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&d.scrollWidth<=d.clientWidth})()`, 'installation guide fits the viewport and scrolls vertically');
const mockPrompt = (outcome, fail = false) => evaluate(`(()=>{window.__promptCalls=0;const e=new Event('beforeinstallprompt');e.prompt=async()=>{window.__promptCalls++;${fail ? 'throw new Error("mock browser install failure")' : ''}};e.userChoice=Promise.resolve({outcome:${JSON.stringify(outcome)},platform:'web'});dispatchEvent(e)})()`);

run('close');
run('open', process.env.INSTALL_TEST_URL || 'http://localhost:3000');
run('wait', '--fn', `!!document.getElementById('login-password')`);
run('errors', '--clear');
run('set', 'viewport', '1440', '900');
check(`document.querySelector(${JSON.stringify(install)}+' img')?.getAttribute('src')==='/icon.svg'`, 'installation button uses the system logo before login');
run('click', guides);waitGuide();
check(`document.querySelector(${JSON.stringify(device)}).value==='WINDOWS' && document.querySelector(${JSON.stringify(browser)}).value==='CHROME'`, 'desktop browser is detected automatically');
run('press', 'Tab');
check(`document.activeElement.getAttribute('aria-label')==='Đóng hướng dẫn cài ứng dụng'`, 'keyboard focus stays inside the guide');
run('press', 'Shift+Tab');
check(`document.activeElement.textContent.includes('Đã hiểu')`, 'reverse tab wraps to the last dialog control');
run('press', 'Tab');
check(`document.activeElement.getAttribute('aria-label')==='Đóng hướng dẫn cài ứng dụng'`, 'forward tab wraps to the first dialog control');

const cases = [
  ['IOS', 'SAFARI', 'màn hình chính', 'install-ios'],
  ['ANDROID', 'CHROME', 'Cài đặt và tạo lối tắt', 'install-android'],
  ['ANDROID', 'SAMSUNG', 'Samsung Internet'],
  ['WINDOWS', 'EDGE', 'edge://apps', 'install-windows'],
  ['WINDOWS', 'FIREFOX', 'Firefox Web Apps'],
  ['MAC', 'SAFARI', 'Sonoma 14', 'install-mac'],
  ['MAC', 'CHROME', 'Giữ trong Dock'],
  ['LINUX', 'CHROME', 'Launcher'],
  ['CHROMEOS', 'CHROME', 'Chromebook'],
  ['LINUX', 'FIREFOX', 'trình duyệt hỗ trợ'],
];
for (const [platform, appBrowser, expected, image] of cases) {
  run('select', device, platform);
  run('select', browser, appBrowser);
  run('wait', '--fn', `document.querySelector(${JSON.stringify(guide)}).textContent.includes(${JSON.stringify(expected)})`);
  check(`document.querySelector(${JSON.stringify(guide)}).textContent.includes(${JSON.stringify(expected)})`, `${platform} / ${appBrowser} shows the matching installation steps`);
  if (image) screenshot(image);
}
run('press', 'Escape');
check(`!document.querySelector(${JSON.stringify(guide)}) && document.activeElement.getAttribute('aria-label')==='Hướng dẫn cài trên mọi thiết bị' && document.body.style.overflow!=='hidden'`, 'Escape closes the guide and restores focus and page scrolling');

mockPrompt('dismissed');
run('click', install);
run('wait', '--fn', `window.__promptCalls===1 && !document.querySelector(${JSON.stringify(install)}).disabled`);
check(`window.__promptCalls===1 && !document.querySelector(${JSON.stringify(guide)}) && document.querySelector(${JSON.stringify(install)})`, 'native install opens immediately and cancellation keeps the button available');
mockPrompt('accepted');
run('click', install);
run('wait', '--fn', `window.__promptCalls===1 && !document.querySelector(${JSON.stringify(install)}).disabled`);
check(`document.querySelector(${JSON.stringify(install)})`, 'accepting a browser prompt alone does not report installation as completed');
evaluate(`dispatchEvent(new Event('appinstalled'))`);
run('wait', '--fn', `!document.querySelector(${JSON.stringify(install)})`);
check(`!document.querySelector(${JSON.stringify(guides)})`, 'successful appinstalled event hides installation controls');
run('reload');run('wait', '--fn', `!!document.querySelector(${JSON.stringify(install)})`);
mockPrompt('dismissed', true);
run('click', install);waitGuide();
check(`document.querySelector(${JSON.stringify(guide)}+' [role="alert"]')?.textContent.includes('Chưa mở được hộp cài')`, 'failed native installation opens helpful fallback instructions');
closeGuide();

for (const [emulatedDevice, platform] of [['Pixel 7', 'ANDROID'], ['iPhone 14', 'IOS'], ['iPad Pro', 'IOS']]) {
  run('set', 'device', emulatedDevice);run('reload');
  run('wait', '--fn', `!!document.querySelector(${JSON.stringify(install)})`);
  // Android Chrome can supply its native install prompt; inspect its manual guide separately.
  run('click', platform === 'IOS' ? install : guides);waitGuide();
  check(`document.querySelector(${JSON.stringify(device)}).value===${JSON.stringify(platform)}`, `${emulatedDevice} selects its own installation guide`);
  fits();screenshot(`install-${emulatedDevice.replaceAll(' ', '-').toLowerCase()}`);closeGuide();
}
run('set', 'viewport', '320', '740');run('click', guides);waitGuide();fits();
screenshot('install-mobile-320');
run('set', 'viewport', '740', '320');fits();screenshot('install-mobile-landscape');
closeGuide();
check(`await (async()=>{const manifest=await fetch('/manifest.json').then(r=>r.json());if(manifest.orientation!=='any'||manifest.display!=='standalone')return false;const entries=[...manifest.icons.filter(i=>i.type==='image/png').map(i=>({src:i.src,size:Number(i.sizes.split('x')[0])})),...Array.from(document.querySelectorAll('link[rel="apple-touch-icon"]')).map(i=>({src:i.href,size:Number(i.sizes.value.split('x')[0])}))];for(const item of entries){const image=new Image();image.src=item.src;await image.decode();if(image.naturalWidth!==item.size||image.naturalHeight!==item.size)return false;}return entries.length===6})()`, 'phone, tablet and desktop icon assets load at the declared sizes with rotation enabled');
assert.equal(run('errors'), '', 'installation flows have no runtime errors');
run('close');
console.log('Cross-device installation checks passed (Chrome device emulation and simulated native browser prompts).');
