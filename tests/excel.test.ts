import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';

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
