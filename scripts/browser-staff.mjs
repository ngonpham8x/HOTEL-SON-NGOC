import assert from 'node:assert/strict';
import { copyFileSync } from 'node:fs';
import { createBrowserCLI } from './browser-cli.mjs';
import { loginBrowser } from './browser-auth.mjs';

const run = createBrowserCLI('sonngoc-staff-review');
const evaluate = js => run('eval', js);
const wait = js => run('wait', '--fn', js);
const check = (js, label) => { assert.equal(evaluate(`Boolean(${js})`), 'true', label); console.log('PASS', label); };
const clickText = (selector, text) => evaluate(`(()=>{const e=Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find(e=>e.textContent.includes(${JSON.stringify(text)}));if(!e)throw new Error('Missing control '+${JSON.stringify(text)});e.click();})()`);
const dismissToasts = () => evaluate(`document.querySelectorAll('div.pointer-events-auto > button').forEach(e=>e.click())`);
const nav = text => { wait(`!!document.querySelector('button[aria-label="Ẩn hiện menu"]')`); dismissToasts(); evaluate(`document.querySelector('button[aria-label="Ẩn hiện menu"]').click()`); clickText('aside nav button', text); };
const snapshot = () => JSON.parse(evaluate(`JSON.parse(localStorage.getItem('son_ngoc_hotel_data_v3')).data`));
const picture = name => { const file = run('screenshot').match(/Screenshot saved to (.+)/)?.[1]?.trim(); if (file) copyFileSync(file, `.review/${name}.png`); };
const overflow = () => check(`document.documentElement.scrollWidth<=window.innerWidth+1`, 'page fits the mobile viewport');
const field = (selector, value) => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
const toggleCheckbox = (label, wanted) => evaluate(`(()=>{const e=Array.from(document.querySelectorAll('form[aria-label="Cấp quyền tài khoản lễ tân"] label')).find(e=>e.textContent.includes(${JSON.stringify(label)}));if(!e)throw new Error('Missing checkbox '+${JSON.stringify(label)});const c=e.querySelector('input[type="checkbox"]');if(c.checked!==${wanted})c.click();})()`);
const saveAccount = () => { run('click', 'form[aria-label="Cấp quyền tài khoản lễ tân"] button[type="submit"]'); wait(`Array.from(document.querySelectorAll('p[role="status"]')).some(e=>e.textContent.includes('Đã lưu tài khoản'))`); };
const staffPassword = 'Reception Browser QA@2026';
const staffLogin = () => {
  wait(`Array.from(document.querySelectorAll('button')).some(e=>e.textContent.trim()==='Lễ tân')`);
  clickText('button', 'Lễ tân');
  wait(`!!document.querySelector('#login-username')`);
  run('fill', '#login-username', 'reception.browser');
  run('fill', '#login-password', staffPassword);
  run('click', 'form[aria-label="Đăng nhập hệ thống"] button[type="submit"]');
};
const confirm = label => { clickText('div.fixed button', label); };
const deleteCatalogItem = (name, title) => evaluate(`(()=>{const row=Array.from(document.querySelectorAll('main tbody tr')).find(e=>e.textContent.includes(${JSON.stringify(name)}));if(!row)throw new Error('Missing row '+${JSON.stringify(name)});row.querySelector(${JSON.stringify(`button[title="${title}"]`)}).click();})()`);

try {
  run('close'); run('open', 'http://localhost:3000'); run('wait', '--load', 'networkidle'); wait(`!!document.querySelector('header')||!!document.querySelector('#login-password')`); loginBrowser(run);
  evaluate(`(async()=>{const m=await import('/src/data/initialData.ts');const room=n=>({...m.INITIAL_ROOMS.find(r=>r.number===n),status:'AVAILABLE',cleanStatus:'CLEAN',currentStayId:undefined,currentGuestName:undefined});const invoice={...m.INITIAL_INVOICES[0],customerName:'QA preserved invoice'};const ids=new Set(invoice.services.map(s=>s.serviceId));const services=m.INITIAL_SERVICES.filter(s=>ids.has(s.id));const unused=m.INITIAL_SERVICES.find(s=>!ids.has(s.id));services.push({...unused,name:'QA unused service'});localStorage.removeItem('son_ngoc_staff_accounts_v1');sessionStorage.removeItem('son_ngoc_staff_session_v1');localStorage.setItem('son_ngoc_hotel_data_v3',JSON.stringify({version:3,data:{rooms:[room('N04'),room('N07')],services,stays:[],reservations:[],invoices:[invoice],debts:m.INITIAL_DEBTS.filter(d=>d.invoiceId===invoice.id)}}));return true})()`);
  run('reload'); run('wait', '--load', 'networkidle'); wait(`!!document.querySelector('header')`); run('set', 'viewport', '1440', '1000'); run('errors', '--clear');
  const original = snapshot();
  assert.equal(original.rooms.length, 2); assert.equal(original.invoices.length, 1);
  const usedService = original.services.find(s => original.invoices[0].services.some(u => u.serviceId === s.id));
  const unusedService = original.services.find(s => s.name === 'QA unused service');

  nav('Phân quyền lễ tân'); wait(`!!document.querySelector('form[aria-label="Cấp quyền tài khoản lễ tân"]')`);
  run('fill', 'input[aria-label="Tên lễ tân"]', 'QA Lễ tân chỉ xem');
  run('fill', 'input[aria-label="Tên đăng nhập lễ tân"]', 'reception.browser');
  run('fill', 'input[aria-label="Mật khẩu lễ tân"]', staffPassword);
  clickText('form button', 'Chỉ xem'); saveAccount();
  assert.deepEqual(snapshot(), original); console.log('PASS account creation and readonly permissions do not modify hotel data');
  picture('staff-permissions-desktop'); run('set', 'viewport', '375', '812'); overflow(); picture('staff-permissions-mobile');

  // The named management tab shares local data, while login sessions stay separate.
  run('tab', 'new', '--label', 'manager', 'http://localhost:3000'); run('wait', '--load', 'networkidle'); wait(`!!document.querySelector('header')||!!document.querySelector('#login-password')`); loginBrowser(run); run('set', 'viewport', '1440', '1000');
  nav('Phân quyền lễ tân'); wait(`!!document.querySelector('form[aria-label="Cấp quyền tài khoản lễ tân"]')`);
  run('tab', 't1'); run('set', 'viewport', '1440', '1000'); run('click', 'button[aria-label="Đăng xuất"]'); wait(`!!document.querySelector('#login-password')`);
  staffLogin(); wait(`!!document.querySelector('header')`);
  check(`document.querySelector('aside').textContent.includes('Lễ tân · reception.browser')`, 'receptionist has a distinct visible role');
  check(`!Array.from(document.querySelectorAll('aside nav button')).some(e=>/Phân quyền|Thống kê doanh thu|Xuất Excel|Trang chủ/.test(e.textContent))`, 'receptionist cannot navigate manager settings or revenue reports');
  check(`!document.querySelector('header button[title="Đặt phòng trước cho khách"]')&&!document.querySelector('header button[aria-label="Nhận phòng"]')&&!document.querySelector('header button[title="Thêm phòng mới vào khách sạn"]')`, 'readonly login exposes no quick create actions');
  nav('Sơ đồ phòng'); wait(`document.querySelector('main')?.textContent.includes('N04')`);
  check(`!Array.from(document.querySelectorAll('main button')).some(e=>/Đặt trước|Nhận phòng ngay|Trả phòng/.test(e.textContent)||e.textContent.trim()==='Nhận')`, 'readonly room view exposes no booking or check-in action');
  nav('Đặt phòng'); wait(`document.querySelector('main')?.textContent.includes('Chờ nhận phòng')`);
  check(`!Array.from(document.querySelectorAll('main button')).some(e=>e.textContent.includes('Thêm đặt phòng'))`, 'readonly reservation view hides creation');
  nav('Bảng giá & Dịch vụ'); wait(`document.querySelector('main')?.textContent.includes('Danh Sách Dịch Vụ')`);
  check(`!document.querySelector('main button[title="Xóa dịch vụ khỏi hệ thống"]')&&!document.querySelector('main button[title="Chỉnh sửa tên, phân loại hoặc đơn giá"]')&&!Array.from(document.querySelectorAll('main button')).some(e=>e.textContent.includes('Thêm Dịch Vụ'))`, 'readonly catalog hides edit/delete controls');
  assert.deepEqual(snapshot(), original); picture('staff-readonly-desktop'); run('set', 'viewport', '375', '812'); overflow(); picture('staff-readonly-mobile');

  run('tab', 'manager'); run('set', 'viewport', '1440', '1000'); run('click', 'button[aria-label="Sửa quyền QA Lễ tân chỉ xem"]');
  for (const label of ['Xóa phòng chưa có dữ liệu liên quan', 'Xóa dịch vụ chưa được sử dụng', 'Tạo đặt phòng', 'Hủy đặt phòng (giữ lịch sử và cọc)', 'Lưu trữ phiếu đã hủy, không có cọc']) toggleCheckbox(label, true);
  saveAccount(); assert.deepEqual(snapshot(), original); console.log('PASS management permission update preserves hotel data');
  run('tab', 't1'); wait(`!!document.querySelector('#login-password')`); console.log('PASS permission update revokes the old receptionist session');
  staffLogin(); wait(`!!document.querySelector('header')`); run('set', 'viewport', '1440', '1000');

  nav('Bảng giá & Dịch vụ'); wait(`!!document.querySelector('main button[title="Xóa dịch vụ khỏi hệ thống"]')`);
  deleteCatalogItem(usedService.name, 'Xóa dịch vụ khỏi hệ thống'); confirm('Xác nhận xóa');
  wait(`document.body.textContent.includes('Dịch vụ đã được sử dụng')`); assert.deepEqual(snapshot(), original); console.log('PASS used service deletion is blocked and financial history is preserved'); dismissToasts();
  deleteCatalogItem(unusedService.name, 'Xóa dịch vụ khỏi hệ thống'); confirm('Xác nhận xóa'); wait(`!Array.from(document.querySelectorAll('main tbody tr')).some(e=>e.textContent.includes('QA unused service'))`);
  assert.equal(snapshot().services.some(s => s.id === unusedService.id), false); console.log('PASS unused service can be deleted with its assigned permission');
  clickText('main button', 'Cấu hình giá phòng'); wait(`!!document.querySelector('main button[title="Xóa phòng khỏi hệ thống"]')`);
  deleteCatalogItem('N04', 'Xóa phòng khỏi hệ thống'); confirm('Xác nhận xóa'); wait(`document.body.textContent.includes('Phòng đã có dữ liệu liên quan')`);
  assert.equal(snapshot().rooms.some(r => r.number === 'N04'), true); assert.deepEqual(snapshot().invoices, original.invoices); assert.deepEqual(snapshot().debts, original.debts); console.log('PASS historical room deletion is blocked without changing invoices or debt'); dismissToasts();
  deleteCatalogItem('N07', 'Xóa phòng khỏi hệ thống'); confirm('Xác nhận xóa'); wait(`!Array.from(document.querySelectorAll('main tbody tr')).some(e=>e.textContent.includes('N07'))`);
  assert.equal(snapshot().rooms.some(r => r.number === 'N07'), false); console.log('PASS unused room can be deleted with its assigned permission');

  nav('Đặt phòng'); wait(`Array.from(document.querySelectorAll('main button')).some(e=>e.textContent.includes('Thêm đặt phòng'))`);
  clickText('main button', 'Thêm đặt phòng'); wait(`!!document.querySelector('select[aria-label="Phòng đặt trước"]')`);
  run('select', 'select[aria-label="Phòng đặt trước"]', 'room-n04'); run('fill', 'input[placeholder="VD: Trần Quốc Bảo"]', 'QA archived booking'); run('fill', 'input[placeholder="VD: 0988776655"]', '0900000000');
  const start = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), end = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
  field('input[aria-label="Ngày nhận đặt trước"]', start); field('input[aria-label="Ngày trả đặt trước"]', end); run('fill', 'input[aria-label="Tiền cọc đặt phòng (VNĐ)"]', '0'); run('click', 'form button[type="submit"]');
  wait(`!document.querySelector('select[aria-label="Phòng đặt trước"]')`); run('click', 'button[title="Hủy đặt phòng này"]'); confirm('Hủy đặt phòng');
  wait(`JSON.parse(localStorage.getItem('son_ngoc_hotel_data_v3')).data.reservations[0]?.status==='CANCELLED'`); dismissToasts(); clickText('main button', 'Đã hủy ('); clickText('main button', 'Lưu trữ'); confirm('Lưu trữ');
  wait(`JSON.parse(localStorage.getItem('son_ngoc_hotel_data_v3')).data.reservations[0]?.archived===true`); dismissToasts();
  check(`!document.querySelector('main').textContent.includes('QA archived booking')`, 'archived booking is hidden from the regular list');
  const archived = snapshot().reservations[0]; assert.equal(archived.status, 'CANCELLED'); assert.equal(archived.depositAmount, 0); assert.equal(archived.archived, true);
  evaluate(`Array.from(document.querySelectorAll('main label')).find(e=>e.textContent.includes('Hiện phiếu đã lưu trữ')).querySelector('input').click()`);
  check(`document.querySelector('main').textContent.includes('QA archived booking')`, 'archived booking remains available in history');
  assert.deepEqual(snapshot().invoices, original.invoices); assert.deepEqual(snapshot().debts, original.debts); console.log('PASS create/cancel/archive preserves the ledger');
  const beforeDisable = snapshot();

  run('tab', 'manager'); run('click', 'button[aria-label="Tải lại danh sách lễ tân"]'); wait(`!document.querySelector('button[aria-label="Tải lại danh sách lễ tân"]').disabled`); run('click', 'button[aria-label="Sửa quyền QA Lễ tân chỉ xem"]'); toggleCheckbox('Cho phép đăng nhập', false);
  run('click', 'form[aria-label="Cấp quyền tài khoản lễ tân"] button[type="submit"]'); confirm('Khóa và lưu'); wait(`document.querySelector('main').textContent.includes('Đã khóa truy cập')`);
  assert.deepEqual(snapshot(), beforeDisable); run('tab', 't1'); wait(`!!document.querySelector('#login-password')`); staffLogin(); wait(`!!document.querySelector('#login-error')`);
  check(`!document.querySelector('header')&&document.querySelector('#login-error').textContent.includes('đã bị khóa')`, 'disabled receptionist is logged out and cannot sign in');
  assert.deepEqual(snapshot(), beforeDisable); assert.equal(run('errors'), ''); run('tab', 'manager'); assert.equal(run('errors'), '');
  console.log('Staff access browser checks passed.');
} catch (error) {
  try { console.error('Staff UI at failure:', evaluate(`({url:location.href,ready:document.readyState,text:document.body.innerText,root:!!document.querySelector('#root')})`)); console.error('Browser errors:', run('errors')); console.error('Network requests:', run('network', 'requests')); picture('staff-failure'); } catch { /* Original error remains the test result. */ }
  throw error;
} finally { run('close'); }
