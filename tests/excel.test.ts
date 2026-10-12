import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { exportRevenueToExcel } from '../src/utils/exportExcel';
import { prepareServiceSale } from '../src/utils/serviceSale';
import { applySaleEvent } from '../src/utils/serviceSaleLifecycle';
import { localDate, localTime } from '../src/utils/hotelLogic';

test('Excel export still supports conditional formatting after uuid security update', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Doanh thu');
  sheet.addRow(['Phòng', 'Doanh thu']);
  sheet.addRow(['N01', 800000]);
  sheet.addConditionalFormatting({ ref: 'B2', rules: [{ type: 'dataBar', priority: 1, minLength: 0, maxLength: 100, cfvo: [{ type: 'min' }, { type: 'max' }] }] });
  const buffer = await workbook.xlsx.writeBuffer();
  const roundTrip = new ExcelJS.Workbook();
  await roundTrip.xlsx.load(buffer);
  assert.equal(roundTrip.getWorksheet('Doanh thu')?.getCell('B2').value, 800000);
});

test('revenue export includes cancellation, paid refund and outstanding refund without double counting', async () => {
  const original = prepareServiceSale({ customerName: 'QA', phone: '0900000000', items: [{ serviceId: 'm', quantity: 3 }], discount: 0, paidAmount: 600000, paymentMethod: 'CASH' }, [{ id: 'm', name: 'Massage', category: 'MASSAGE', categoryName: 'Massage', price: 200000, unit: 'Vé' }]).invoice;
  const stamp = { date: localDate(), time: localTime(), actorId: 'admin', actorName: 'Quản lý' };
  let invoice = applySaleEvent(original, { ...stamp, id: 'cancel', kind: 'CANCEL', items: [{ usageId: original.services![0].id, quantity: 2 }], fee: 0, reason: 'Khách đổi ý', requestedBy: 'CUSTOMER' });
  invoice = applySaleEvent(invoice, { ...stamp, id: 'refund', kind: 'REFUND', amount: 150000, method: 'TRANSFER', notes: 'Mã hoàn 1' });
  let saved: Blob | undefined;
  const previousWindow = globalThis.window, previousDocument = globalThis.document;
  Object.assign(globalThis, {
    window: { URL: { createObjectURL: (blob: Blob) => { saved = blob; return 'blob:qa'; }, revokeObjectURL: () => {} } },
    document: { createElement: () => ({ click: () => {}, href: '', download: '' }) },
  });
  try {
    await exportRevenueToExcel([invoice]);
    assert.ok(saved);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await saved.arrayBuffer());
    const revenue = workbook.getWorksheet('Chi Tiết Doanh Thu')!;
    assert.equal(revenue.getCell('O5').value, 200000);
    assert.equal(revenue.getCell('P5').value, 450000);
    const history = workbook.getWorksheet('Hủy Vé và Hoàn Tiền')!;
    assert.equal(history.getCell('H3').value, 150000);
    assert.equal(history.getCell('J3').value, 250000);
    assert.equal(history.getCell('I3').value, 'Chuyển khoản (QR)');
  } finally { Object.assign(globalThis, { window: previousWindow, document: previousDocument }); }
});
