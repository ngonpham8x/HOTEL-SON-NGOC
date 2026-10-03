import assert from 'node:assert/strict';
import { copyFileSync } from 'node:fs';
import { createBrowserCLI } from './browser-cli.mjs';
import { loginBrowser } from './browser-auth.mjs';

const run=createBrowserCLI('sonngoc-price-review');
const evaluate=js=>run('eval',js);
const wait=js=>run('wait','--fn',js);
const check=(js,label)=>{assert.equal(evaluate(`Boolean(${js})`),'true',label);console.log('PASS',label);};
const clickText=(selector,text)=>{evaluate(`Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find(e=>e.textContent.includes(${JSON.stringify(text)})).click()`);};
const services=()=>{evaluate(`document.querySelector('button[aria-label="Ẩn hiện menu"]').click()`);clickText('aside nav button','Bảng giá');wait(`!!document.querySelector('main button[title="Chỉnh sửa tên, phân loại hoặc đơn giá"]')`);};
const save=()=>{run('click','form button[type="submit"]');wait(`!document.querySelector('form input[aria-label="Đơn giá niêm yết (VNĐ)"]')`);};
const rental=()=>{evaluate(`Array.from(document.querySelectorAll('main tbody tr')).find(e=>e.textContent.includes('Thuê xe máy')).querySelector('button[title="Chỉnh sửa tên, phân loại hoặc đơn giá"]').click()`);wait(`!!document.querySelector('input[aria-label="Đơn giá niêm yết (VNĐ)"]')`);};
const screenshot=name=>{const output=run('screenshot');const file=output.match(/Screenshot saved to (.+)/)?.[1]?.trim();if(file)copyFileSync(file,`.review/${name}.png`);};

run('close');run('open','http://localhost:3000');loginBrowser(run);
evaluate(`(async()=>{const m=await import('/src/data/initialData.ts');const room={...m.INITIAL_ROOMS[0],id:'price-qa-room',number:'PR01',status:'AVAILABLE',cleanStatus:'CLEAN',allowsHourly:true,defaultCheckInTime:'14:00',defaultCheckOutTime:'12:00'};localStorage.setItem('son_ngoc_hotel_data_v3',JSON.stringify({version:3,data:{rooms:[room],services:m.INITIAL_SERVICES,stays:[],reservations:[],invoices:[],debts:[]}}));return true})()`);
run('reload');wait(`!!document.querySelector('header')`);run('set','viewport','375','812');run('errors','--clear');services();
try {
  for(const price of [100000,100001]){
    rental();run('fill','input[aria-label="Đơn giá niêm yết (VNĐ)"]',String(price));
    check(`document.querySelector('input[aria-label="Đơn giá niêm yết (VNĐ)"]').validity.valid && document.querySelector('form').checkValidity()`, `rental price ${price} is accepted without a step mismatch`);
    if(price===100000)screenshot('service-price-100000');
    save();
    check(`JSON.parse(localStorage.getItem('son_ngoc_hotel_data_v3')).data.services.find(s=>s.category==='RENTAL').price===${price}`,`rental price ${price} is saved exactly`);
  }
  rental();
  for(const price of ['-1','0','100000.5']){
    run('fill','input[aria-label="Đơn giá niêm yết (VNĐ)"]',price);
    check(`!document.querySelector('form').checkValidity()`, `invalid service amount ${price} is rejected`);
  }
  clickText('form button','Hủy');
  clickText('main button','+ Thêm Dịch Vụ');wait(`!!document.querySelector('input[aria-label="Đơn giá niêm yết (VNĐ)"]')`);
  run('fill','input[placeholder="VD: Vé Massage Toàn Thân (60p), Nước ngọt..."]','QA Exact VND');
  run('fill','input[placeholder="VD: Vé, Chai, Lon, Suất..."]','Lượt');
  run('fill','input[aria-label="Đơn giá niêm yết (VNĐ)"]','23457');save();
  check(`JSON.parse(localStorage.getItem('son_ngoc_hotel_data_v3')).data.services.some(s=>s.name==='QA Exact VND'&&s.price===23457)`, 'a new service accepts and persists an arbitrary positive VND amount');
  clickText('main button','Cấu hình giá phòng');
  wait(`Array.from(document.querySelectorAll('main button')).some(e=>e.textContent.includes('Sửa giá hạng này'))`);
  clickText('main button','Sửa giá hạng này');wait(`!!document.querySelector('input[aria-label="Giá theo đêm mới (VNĐ)"]')`);
  run('fill','input[aria-label="Giá theo đêm mới (VNĐ)"]','455555');run('fill','input[aria-label="Giá theo giờ mới (VNĐ)"]','111111');
  check(`document.querySelector('form').checkValidity()`, 'room-category prices accept exact VND amounts');
  run('click','form button[type="submit"]');wait(`!document.querySelector('input[aria-label="Giá theo đêm mới (VNĐ)"]')`);
  check(`JSON.parse(localStorage.getItem('son_ngoc_hotel_data_v3')).data.rooms[0].pricePerNight===455555&&JSON.parse(localStorage.getItem('son_ngoc_hotel_data_v3')).data.rooms[0].pricePerHour===111111`, 'room-category prices are saved exactly');
  evaluate(`document.querySelectorAll('div.pointer-events-auto > button').forEach(button=>button.click())`);
  wait(`!document.querySelector('div.pointer-events-auto')`);
  run('click','button[title="Sửa số phòng, giá hoặc thông tin"]');wait(`!!document.querySelector('input[aria-label="Giá theo đêm (VNĐ)"]')`);
  run('fill','input[aria-label="Giá theo đêm (VNĐ)"]','444444');run('fill','input[aria-label="Giá theo giờ (VNĐ)"]','99999');
  check(`document.querySelector('form').checkValidity()`, 'individual room prices accept exact VND amounts');
  run('click','form button[type="submit"]');
  wait(`!!document.querySelector('div[class*="z-[70]"] button.bg-emerald-700')`);
  run('click','div[class*="z-[70]"] button.bg-emerald-700');
  wait(`!document.querySelector('input[aria-label="Giá theo đêm (VNĐ)"]')`);
  run('reload');wait(`!!document.querySelector('header')`);
  check(`(()=>{const d=JSON.parse(localStorage.getItem('son_ngoc_hotel_data_v3')).data;return d.services.find(s=>s.category==='RENTAL').price===100001&&d.rooms[0].pricePerNight===444444&&d.rooms[0].pricePerHour===99999})()`, 'updated service and room amounts persist after a reload');
  assert.equal(run('errors'),'','price updates have no runtime errors');
  console.log('Service and room price update checks passed.');
} finally {run('close');}
