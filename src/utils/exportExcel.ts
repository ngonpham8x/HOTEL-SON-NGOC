import { invoiceRevenue, invoiceCollected, localDate } from './hotelLogic';
import type ExcelJS from 'exceljs';
import { Invoice, DebtRecord, Room } from '../types/hotel';
import { formatDate, getPaymentMethodName } from './formatters';

const saveWorkbook = async (workbook: ExcelJS.Workbook, fileName: string) => {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

// Common header styling
const styleHeaderCell = (cell: ExcelJS.Cell) => {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF065F46' }, // Dark Emerald
  };
  cell.font = {
    name: 'Arial',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FF047857' } },
    left: { style: 'thin', color: { argb: 'FF047857' } },
    bottom: { style: 'medium', color: { argb: 'FF022C22' } },
    right: { style: 'thin', color: { argb: 'FF047857' } },
  };
};

const applyThinBorders = (row: ExcelJS.Row) => {
  row.eachCell({ includeEmpty: true }, cell => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };
  });
};

export const exportRevenueToExcel = async (
  invoices: Invoice[],
  fileName = 'Bao_Cao_Doanh_Thu_Hotel_Son_Ngoc.xlsx'
) => {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Hotel Sơn Ngọc';
  wb.created = new Date();

  // SHEET 1: Chi tiết hóa đơn
  const ws = wb.addWorksheet('Chi Tiết Doanh Thu', {
    views: [{ showGridLines: true }],
  });

  // Hotel Title Banner
  ws.mergeCells('A1:P1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'HOTEL SƠN NGỌC - BÁO CÁO DOANH THU & GIAO DỊCH';
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF065F46' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 32;

  // Subtitle / Hotline / Address
  ws.mergeCells('A2:P2');
  const subCell = ws.getCell('A2');
  subCell.value = 'Địa chỉ: Số 70 Quốc lộ 20, xã Hòa Ninh, Lâm Đồng · Hotline: 0392.089.960 (Ms Trinh) · Ngày xuất: ' + formatDate(localDate());
  subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(2).height = 20;

  // Header row at row 4
  const headerRowIdx = 4;
  const headers = [
    'STT',
    'Mã Hóa Đơn',
    'Ngày Xuất',
    'Giờ',
    'Số Phòng',
    'Khách Hàng',
    'Số Điện Thoại',
    'Lưu Trú',
    'Tiền Phòng (VNĐ)',
    'Vé Massage (VNĐ)',
    'Minibar & Khác (VNĐ)',
    'Phụ Thu (VNĐ)',
    'Giảm Trừ (VNĐ)',
    'Đã Trừ Cọc (VNĐ)',
    'Doanh Thu (VNĐ)',
    'Đã Thu Gồm Cọc (VNĐ)',
    'Khách Nợ (VNĐ)',
    'Phương Thức',
    'Trạng Thái',
  ];

  const headerRow = ws.getRow(headerRowIdx);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    styleHeaderCell(cell);
  });
  headerRow.height = 28;

  let currentRowIdx = 5;
  invoices.forEach((inv, index) => {
    const row = ws.getRow(currentRowIdx);
    const massageAmt = inv.massageCharge || 0;
    const otherServiceAmt = Math.max(0, inv.serviceCharge - massageAmt);
    row.values = [
      index + 1,
      inv.code,
      formatDate(inv.date),
      inv.time,
      inv.kind === 'SERVICE' ? 'Khách ngoài' : `P.${inv.roomNumber}`,
      inv.customerName,
      inv.phone || '---',
      inv.kind === 'SERVICE' ? 'Dịch vụ lẻ' : `${inv.durationNightsOrHours} ${inv.pricingType === 'NIGHT' ? 'đêm' : 'giờ'}`,
      inv.roomCharge,
      massageAmt,
      otherServiceAmt,
      inv.surcharge,
      inv.discount,
      inv.depositDeducted,
      invoiceRevenue(inv),
      invoiceCollected(inv),
      inv.debtAmount,
      getPaymentMethodName(inv.paymentMethod),
      inv.status === 'PAID' ? 'Đã thu đủ' : inv.status === 'PARTIAL' ? 'Thanh toán 1 phần' : 'Ghi nợ',
    ];

    applyThinBorders(row);
    row.height = 22;

    // Number formats for currency columns (cols 9 to 17)
    for (let c = 9; c <= 17; c++) {
      const cell = row.getCell(c);
      cell.numFmt = '#,##0';
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }

    // Alignments
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(18).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(19).alignment = { vertical: 'middle', horizontal: 'center' };

    // Highlight row on zebra
    if (index % 2 === 1) {
      row.eachCell({ includeEmpty: true }, cell => {
        if (!cell.fill) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
        }
      });
    }

    currentRowIdx++;
  });

  // Total summary row
  const totalRow = ws.getRow(currentRowIdx);
  totalRow.getCell(1).value = 'TỔNG CỘNG DOANH THU';
  totalRow.getCell(9).value = { formula: `SUM(I5:I${currentRowIdx - 1})` };
  totalRow.getCell(10).value = { formula: `SUM(J5:J${currentRowIdx - 1})` };
  totalRow.getCell(11).value = { formula: `SUM(K5:K${currentRowIdx - 1})` };
  totalRow.getCell(12).value = { formula: `SUM(L5:L${currentRowIdx - 1})` };
  totalRow.getCell(13).value = { formula: `SUM(M5:M${currentRowIdx - 1})` };
  totalRow.getCell(14).value = { formula: `SUM(N5:N${currentRowIdx - 1})` };
  totalRow.getCell(15).value = { formula: `SUM(O5:O${currentRowIdx - 1})` };
  totalRow.getCell(16).value = { formula: `SUM(P5:P${currentRowIdx - 1})` };
  totalRow.getCell(17).value = { formula: `SUM(Q5:Q${currentRowIdx - 1})` };

  ws.mergeCells(`A${currentRowIdx}:H${currentRowIdx}`);
  totalRow.height = 26;
  totalRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF065F46' } };
  totalRow.alignment = { vertical: 'middle', horizontal: 'right' };

  totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFECFDF5' }, // Emerald-50
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF059669' } },
      bottom: { style: 'double', color: { argb: 'FF059669' } },
    };
    if (colNumber >= 9 && colNumber <= 17) {
      cell.numFmt = '#,##0';
    }
  });

  // Adjust column widths automatically
  ws.columns = [
    { width: 7 },  // STT
    { width: 16 }, // Mã HĐ
    { width: 13 }, // Ngày
    { width: 9 },  // Giờ
    { width: 11 }, // Phòng
    { width: 24 }, // Tên Khách
    { width: 14 }, // SĐT
    { width: 12 }, // Lưu Trú
    { width: 16 }, // Tiền Phòng
    { width: 16 }, // Minibar
    { width: 14 }, // Phụ Thu
    { width: 14 }, // Giảm Trừ
    { width: 15 }, // Đã Trừ Cọc
    { width: 18 }, // Tổng Phải Thu
    { width: 16 }, // Thực Thu
    { width: 15 }, // Khách Nợ
    { width: 16 }, // Phương Thức
    { width: 18 }, // Trạng Thái
  ];

  await saveWorkbook(wb, fileName);
};

export const exportDebtsToExcel = async (
  debts: DebtRecord[],
  fileName = 'Bao_Cao_Cong_No_Khach_Hotel_Son_Ngoc.xlsx'
) => {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Hotel Sơn Ngọc';

  const ws = wb.addWorksheet('Sổ Công Nợ Khách Hàng', {
    views: [{ showGridLines: true }],
  });

  // Title Banner
  ws.mergeCells('A1:K1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'HOTEL SƠN NGỌC - SỔ THEO DÕI CÔNG NỢ KHÁCH HÀNG';
  titleCell.font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FF991B1B' } }; // Rose/Red
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:K2');
  const subCell = ws.getCell('A2');
  subCell.value = 'Địa chỉ: Số 70 Quốc lộ 20, xã Hòa Ninh, Lâm Đồng · Hotline: 0392.089.960 (Ms Trinh) · Dữ liệu đối soát thời gian thực';
  subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(2).height = 18;

  // Header Row
  const headerRow = ws.getRow(4);
  const headers = [
    'STT',
    'Mã HĐ',
    'Khách Hàng / Đơn Vị',
    'Số Điện Thoại',
    'Phòng Đã Ở',
    'Ngày Phát Sinh',
    'Hạn Thanh Toán',
    'Tổng Giá Trị HĐ (VNĐ)',
    'Số Nợ Ban Đầu (VNĐ)',
    'Đã Thu Hồi (VNĐ)',
    'Còn Phải Thu (VNĐ)',
    'Trạng Thái',
    'Ghi Chú',
  ];

  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF991B1B' }, // Deep Rose
    };
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF7F1D1D' } },
      bottom: { style: 'medium', color: { argb: 'FF450A0A' } },
    };
  });
  headerRow.height = 26;

  let rowIdx = 5;
  debts.forEach((debt, idx) => {
    const row = ws.getRow(rowIdx);
    row.values = [
      idx + 1,
      debt.invoiceCode,
      debt.customerName,
      debt.phone,
      debt.roomNumber,
      formatDate(debt.createdDate),
      formatDate(debt.dueDate),
      debt.totalInvoiceAmount,
      debt.originalDebt,
      debt.paidAmount,
      debt.remainingAmount,
      debt.status === 'SETTLED' ? 'Đã thu xong' : debt.status === 'OVERDUE' ? 'Quá hạn' : debt.status === 'PARTIAL' ? 'Đã trả một phần' : 'Chưa thanh toán',
      debt.notes || '',
    ];

    applyThinBorders(row);
    row.height = 22;

    // Currency formatting (cols 8..11)
    for (let c = 8; c <= 11; c++) {
      const cell = row.getCell(c);
      cell.numFmt = '#,##0';
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }

    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(12).alignment = { vertical: 'middle', horizontal: 'center' };

    rowIdx++;
  });

  // Total summary row
  const totalRow = ws.getRow(rowIdx);
  totalRow.getCell(1).value = 'TỔNG CỘNG CÔNG NỢ';
  ws.mergeCells(`A${rowIdx}:G${rowIdx}`);
  totalRow.getCell(8).value = { formula: `SUM(H5:H${rowIdx - 1})` };
  totalRow.getCell(9).value = { formula: `SUM(I5:I${rowIdx - 1})` };
  totalRow.getCell(10).value = { formula: `SUM(J5:J${rowIdx - 1})` };
  totalRow.getCell(11).value = { formula: `SUM(K5:K${rowIdx - 1})` };

  totalRow.height = 26;
  totalRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF991B1B' } };
  totalRow.alignment = { vertical: 'middle', horizontal: 'right' };

  totalRow.eachCell({ includeEmpty: true }, (cell, c) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF1F2' },
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF991B1B' } },
      bottom: { style: 'double', color: { argb: 'FF991B1B' } },
    };
    if (c >= 8 && c <= 11) {
      cell.numFmt = '#,##0';
    }
  });

  ws.columns = [
    { width: 6 },
    { width: 16 },
    { width: 28 },
    { width: 14 },
    { width: 22 },
    { width: 14 },
    { width: 14 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 16 },
    { width: 30 },
  ];

  await saveWorkbook(wb, fileName);
};

export const exportRoomsToExcel = async (
  rooms: Room[],
  fileName = 'Danh_Sach_Phong_Hotel_Son_Ngoc.xlsx'
) => {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Hotel Sơn Ngọc';

  const ws = wb.addWorksheet('Danh Sách Phòng', {
    views: [{ showGridLines: true }],
  });

  // Title Banner
  ws.mergeCells('A1:J1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'HOTEL SƠN NGỌC - SƠ ĐỒ & BẢNG GIÁ PHÒNG';
  titleCell.font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:J2');
  const subCell = ws.getCell('A2');
  subCell.value = 'Địa chỉ: Số 70 Quốc lộ 20, xã Hòa Ninh, Lâm Đồng · Hotline: 0392.089.960 (Ms Trinh) · Quy mô: ' + rooms.length + ' phòng';
  subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(2).height = 18;

  // Header Row
  const headerRow = ws.getRow(4);
  const headers = [
    'STT',
    'Số Phòng',
    'Tầng',
    'Hạng Phòng',
    'Giá Theo Đêm (VNĐ)',
    'Giá Theo Giờ (VNĐ)',
    'Sức Chứa',
    'Tình Trạng',
    'Vệ Sinh',
    'Khách Đang Ở',
    'Tiện Nghi Phòng',
  ];

  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' }, // Blue
    };
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  headerRow.height = 26;

  let rowIdx = 5;
  rooms.forEach((r, idx) => {
    const row = ws.getRow(rowIdx);
    row.values = [
      idx + 1,
      r.number,
      `Tầng ${r.floor}`,
      r.typeName,
      r.pricePerNight,
      r.pricePerHour,
      `${r.maxGuests} người`,
      r.status === 'AVAILABLE' ? 'Trống sẵn sàng' : r.status === 'OCCUPIED' ? 'Đang có khách' : r.status === 'RESERVED' ? 'Đã đặt' : r.status === 'CLEANING' ? 'Cần dọn' : 'Bảo trì',
      r.cleanStatus === 'CLEAN' ? 'Sạch sẽ' : 'Chưa dọn',
      r.currentGuestName || '---',
      r.amenities.join(', '),
    ];

    applyThinBorders(row);
    row.height = 22;

    row.getCell(5).numFmt = '#,##0';
    row.getCell(6).numFmt = '#,##0';
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };

    rowIdx++;
  });

  ws.columns = [
    { width: 6 },
    { width: 12 },
    { width: 10 },
    { width: 26 },
    { width: 18 },
    { width: 18 },
    { width: 12 },
    { width: 16 },
    { width: 12 },
    { width: 24 },
    { width: 40 },
  ];

  await saveWorkbook(wb, fileName);
};
