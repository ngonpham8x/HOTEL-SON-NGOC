const initialPassword = process.env.SON_NGOC_PRIMARY_TEST_PASSWORD;
if (!initialPassword) throw new Error('Supply the primary password through the process environment.');
import assert from 'node:assert/strict';
import { copyFileSync } from 'node:fs';
import { createBrowserCLI } from './browser-cli.mjs';

const run = createBrowserCLI('sonngoc-password-review');
const url = process.env.PASSWORD_TEST_URL || 'http://127.0.0.1:4173';
const credentialKey = 'son_ngoc_login_credential_v1';
const sessionKey = 'son_ngoc_login_session_v1';
const evaluate = js => run('eval', js);
const check = (js, message) => { assert.equal(evaluate(`(async()=>Boolean(${js}))()`), 'true', message); console.log('PASS', message); };
const wait = js => {
  try { return run('wait', '--fn', js); }
  catch (error) { console.log('STATE',run('snapshot','-i'));console.log('ERRORS',run('errors'));throw error; }
};
const screenshot = name => { const result = run('screenshot'); const path = result.match(/Screenshot saved to (.+)/)?.[1]?.trim(); if (path) copyFileSync(path, `.review/${name}.png`); };
const openDialog = () => {
  evaluate(`document.querySelector('button[aria-label="Ẩn hiện menu"]').click()`);
  wait(`document.querySelector('aside').getBoundingClientRect().left>=0`);
  run('click', 'aside button[aria-label="Đổi mật khẩu"]');
  wait(`!!document.querySelector('form[aria-label="Đổi mật khẩu hệ thống"]')`);
};
const fillChange = (current, next, confirmation = next) => {
  privateFill('#current-password', current);
  privateFill('#new-password', next);
  privateFill('#confirm-password', confirmation);
};
const save = () => run('click', 'form[aria-label="Đổi mật khẩu hệ thống"] button[type="submit"]');
const logIn = password => {
  privateFill('#login-password', password);
  run('click', 'form[aria-label="Đăng nhập hệ thống"] button[type="submit"]');
  wait(`!!document.querySelector('header')`);
};
const logOut = () => {
  evaluate(`document.querySelector('button[aria-label="Ẩn hiện menu"]').click()`);
  wait(`document.querySelector('aside').getBoundingClientRect().left>=0`);
  run('click', 'aside button[aria-label="Đăng xuất"]');
  wait(`!!document.getElementById('login-password')`);
};
const nextPassword = 'SonNgoc@Test2026';
const fixedPassword = process.env.SON_NGOC_FIXED_TEST_PASSWORD;
const privateFill = (selector, value) => {
  run.withInput(`(()=>{const field=document.querySelector(${JSON.stringify(selector)});if(!field||field.type!=='password')throw new Error('Private input must be masked');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,${JSON.stringify(value)});field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`, 'eval', '--stdin');
};
const fixedLogIn = () => {
  privateFill('#login-password', fixedPassword);
  run('click', 'form[aria-label="Đăng nhập hệ thống"] button[type="submit"]');
  wait(`!!document.querySelector('header')`);
  assert.equal(run.withInput(`(()=>{const value=${JSON.stringify(fixedPassword)};return !document.body.textContent.includes(value)&&![...Object.values(localStorage),...Object.values(sessionStorage)].some(item=>String(item).includes(value));})()`, 'eval', '--stdin'), 'true', 'private credential is not displayed or stored in plaintext');
};
run('close');
run('open', url);
// Test the current production build, rather than an older waiting PWA version.
evaluate(`(async()=>{await Promise.all((await navigator.serviceWorker.getRegistrations()).map(r=>r.unregister()));await Promise.all((await caches.keys()).filter(k=>k.startsWith('son-ngoc-')).map(k=>caches.delete(k)));return true})()`);
run('reload');
run('tab', 'new', '--label', 'password-main', url);
wait(`!!document.getElementById('login-password')`);
run('errors', '--clear');
logIn(initialPassword);
const dataBefore = evaluate(`localStorage.getItem('son_ngoc_hotel_data_v3')`);
const credentialBefore = evaluate(`localStorage.getItem(${JSON.stringify(credentialKey)})`);
run('tab', 'new', '--label', 'password-other', url);
wait(`!!document.getElementById('login-password')`);
logIn(initialPassword);
run('tab', 'password-main');

try {
  openDialog();
  check(`document.activeElement.id==='current-password' && document.querySelector('[role="dialog"] img').getAttribute('src')==='/icon.svg'`, 'password dialog focuses the current password and uses the system logo');
  for (const [width, height] of [[1440,900], [320,740], [375,812], [740,320]]) {
    run('set','viewport',String(width),String(height));
    check(`(()=>{const d=document.querySelector('[role="dialog"]'),r=d.getBoundingClientRect();return document.documentElement.scrollWidth===innerWidth&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&d.scrollWidth<=d.clientWidth&&[...d.querySelectorAll('input,button[type="submit"]')].every(e=>e.getBoundingClientRect().right<=innerWidth)})()`, `password dialog fits ${width}x${height}, including the save button`);
    screenshot(`change-password-${width}`);
  }
  run('set','viewport','375','812');
  run('click','button[aria-label="Hiện mật khẩu mới"]');
  check(`document.getElementById('new-password').type==='text'`, 'new password visibility can be enabled');
  run('click','button[aria-label="Ẩn mật khẩu mới"]');
  check(`document.getElementById('new-password').type==='password'`, 'new password can be hidden again');
  for (const [current, next, confirmation, expected, field] of [
    ['incorrect', nextPassword, nextPassword, 'hiện tại chưa đúng', 'current-password'],
    [initialPassword, 'short', 'short', '8 đến 128', 'new-password'],
    [initialPassword, nextPassword, 'Different@Test2026', 'xác nhận chưa khớp', 'confirm-password'],
    [initialPassword, initialPassword, initialPassword, 'khác mật khẩu hiện tại', 'new-password'],
  ]) {
    fillChange(current,next,confirmation);save();
    wait(`document.getElementById('change-password-error')?.textContent.includes(${JSON.stringify(expected)})`);
    check(`document.getElementById(${JSON.stringify(field)}).getAttribute('aria-invalid')==='true' && document.querySelector('header')`, `invalid password change is rejected: ${expected}`);
    assert.equal(evaluate(`localStorage.getItem(${JSON.stringify(credentialKey)})`),credentialBefore,'invalid changes preserve the credential');
  }
  evaluate(`window.__passwordStorageSetter=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===${JSON.stringify(credentialKey)})throw new DOMException('mock quota','QuotaExceededError');return window.__passwordStorageSetter.call(this,key,value)}`);
  fillChange(initialPassword,nextPassword);save();
  wait(`document.getElementById('change-password-error')?.textContent.includes('Không lưu được mật khẩu mới')`);
  check(`document.querySelector('header') && !document.querySelector('form button[type="submit"]').disabled`, 'storage failure shows an error without logging out');
  assert.equal(evaluate(`localStorage.getItem(${JSON.stringify(credentialKey)})`),credentialBefore,'storage failure preserves the credential');
  evaluate(`Storage.prototype.setItem=window.__passwordStorageSetter;delete window.__passwordStorageSetter`);
  run('press','Escape');
  wait(`!document.querySelector('[role="dialog"]')`);
  check(`document.body.style.overflow!=='hidden'`, 'cancelling restores normal page scrolling');
  openDialog();
  fillChange(initialPassword,nextPassword);save();
  wait(`!!document.getElementById('login-password')`);
  check(`!sessionStorage.getItem(${JSON.stringify(sessionKey)}) && document.querySelector('[role="status"]')?.textContent.includes('Đổi mật khẩu thành công')`, 'successful password change clears the session and requests login with the new password');
  check(`!localStorage.getItem(${JSON.stringify(credentialKey)}).includes(${JSON.stringify(nextPassword)}) && !localStorage.getItem(${JSON.stringify(credentialKey)}).includes('Trinh')`, 'stored credentials contain no plaintext password');
  assert.equal(evaluate(`localStorage.getItem('son_ngoc_hotel_data_v3')`),dataBefore,'password change preserves hotel data');
  console.log('PASS password change preserves hotel data');
  run('tab','password-other');
  wait(`!!document.getElementById('login-password')`);
  check(`!sessionStorage.getItem(${JSON.stringify(sessionKey)}) && document.querySelector('[role="status"]')?.textContent.includes('cửa sổ khác')`, 'other open tabs are logged out when the password changes');
  run('tab','password-main');
  privateFill('#login-password',initialPassword);
  run('click','form[aria-label="Đăng nhập hệ thống"] button[type="submit"]');
  wait(`document.getElementById('login-error')?.textContent.includes('Mật khẩu chưa đúng')`);
  check(`!document.querySelector('header')`, 'the old password cannot open the system after a change');
  if (fixedPassword) {
    fixedLogIn();
    console.log('PASS fixed login remains valid after changing the primary password');
    logOut();
  }
  logIn(nextPassword);
  run('reload');wait(`!!document.querySelector('header')`);
  check(`document.querySelector('header')`, 'the new credential and session survive a reload');
  evaluate(`navigator.serviceWorker.ready.then(()=>true)`);
  run('set','offline','on');
  run('reload');wait(`!!document.querySelector('header')`);
  logOut();
  if (fixedPassword) {
    fixedLogIn();
    console.log('PASS fixed login also works offline');
    logOut();
  }
  logIn(nextPassword);
  check(`document.querySelector('header')`, 'the changed password works offline after reloading');
  openDialog();
  evaluate(`Object.defineProperty(window.crypto,'subtle',{configurable:true,value:undefined})`);
  if (fixedPassword) {
    privateFill('#current-password', fixedPassword);
    privateFill('#new-password',initialPassword);
    privateFill('#confirm-password',initialPassword);
  } else fillChange(nextPassword,initialPassword);
  save();
  wait(`!!document.getElementById('login-password')`);
  check(`document.querySelector('[role="status"]')?.textContent.includes('Đổi mật khẩu thành công')`, 'password changes also work offline without SubtleCrypto');
  logIn(initialPassword);
  if (fixedPassword) { logOut();fixedLogIn();console.log('PASS fixed credential stays unchanged after another primary update');logOut();logIn(initialPassword); }
  assert.equal(evaluate(`localStorage.getItem('son_ngoc_hotel_data_v3')`),dataBefore,'changing the password offline preserves hotel data');
  assert.equal(run('errors'),'','password-change and login flows have no runtime errors');
  console.log('Password change, cross-tab logout and offline login checks passed.');
} finally {
  evaluate(`if(window.__passwordStorageSetter){Storage.prototype.setItem=window.__passwordStorageSetter;delete window.__passwordStorageSetter}`);
  run('set','offline','off');
  run('close');
}
