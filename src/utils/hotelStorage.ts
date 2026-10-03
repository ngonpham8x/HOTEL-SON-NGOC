import type { Room, ServiceItem, StayRecord, Reservation, Invoice, DebtRecord } from '../types/hotel';
import { roomDefaults } from './hotelLogic';

export interface HotelData { rooms: Room[]; services: ServiceItem[]; stays: StayRecord[]; reservations: Reservation[]; invoices: Invoice[]; debts: DebtRecord[] }
export const DATA_KEY = 'son_ngoc_hotel_data_v3';
const fields = ['rooms', 'services', 'stays', 'reservations', 'invoices', 'debts'] as const;
const required: Record<typeof fields[number], string[]> = {
  rooms: ['number', 'type', 'typeName', 'status', 'cleanStatus'], services: ['name', 'category', 'categoryName', 'unit'],
  stays: ['roomId', 'roomNumber', 'customerName', 'phone', 'checkInDate', 'checkInTime', 'expectedCheckOutDate', 'expectedCheckOutTime', 'status', 'pricingType'],
  reservations: ['roomId', 'roomNumber', 'customerName', 'phone', 'checkInDate', 'checkInTime', 'checkOutDate', 'checkOutTime', 'status', 'code'],
  invoices: ['code', 'stayId', 'roomNumber', 'customerName', 'phone', 'date', 'time', 'pricingType', 'status'],
  debts: ['invoiceId', 'invoiceCode', 'customerName', 'phone', 'roomNumber', 'dueDate', 'status'],
};
const amounts: Record<typeof fields[number], string[]> = {
  rooms: ['floor', 'maxGuests', 'pricePerNight', 'pricePerHour'], services: ['price'], stays: ['rateApplied', 'deposit'],
  reservations: ['depositAmount', 'estimatedTotal', 'guestsCount'], invoices: ['durationNightsOrHours', 'roomCharge', 'serviceCharge', 'surcharge', 'discount', 'depositDeducted', 'totalAmount', 'paidAmount', 'debtAmount'],
  debts: ['totalInvoiceAmount', 'originalDebt', 'paidAmount', 'remainingAmount'],
};
export function validateHotelData(input: unknown): HotelData {
  if (!input || typeof input !== 'object') throw new Error('Tệp dữ liệu không hợp lệ.');
  const data = input as Record<string, unknown>;
  for (const field of fields) {
    if (!Array.isArray(data[field])) throw new Error(`Dữ liệu ${field} không hợp lệ.`);
    const ids = new Set<string>();
    for (const row of data[field] as Record<string, unknown>[]) {
      if (!row || typeof row.id !== 'string' || ids.has(row.id) || required[field].some(k => typeof row[k] !== 'string') || amounts[field].some(k => typeof row[k] !== 'number' || !Number.isFinite(row[k]) || (row[k] as number) < 0)) throw new Error(`Bản ghi ${field} không hợp lệ.`);
      ids.add(row.id);
      const nested = field === 'rooms' ? 'amenities' : field === 'stays' ? 'services' : field === 'debts' ? 'paymentHistory' : null;
      if (nested && !Array.isArray(row[nested])) throw new Error(`Chi tiết ${field} không hợp lệ.`);
      if (field === 'rooms' && (row.amenities as unknown[]).some(v => typeof v !== 'string')) throw new Error('Tiện nghi phòng không hợp lệ.');
      if (field === 'stays' || (field === 'invoices' && row.services !== undefined)) {
        if (!Array.isArray(row.services) || row.services.some(s => !s || typeof s.id !== 'string' || typeof s.name !== 'string' || typeof s.serviceId !== 'string' || !Number.isInteger(s.quantity) || s.quantity < 1 || !Number.isSafeInteger(s.unitPrice) || s.unitPrice < 0 || s.totalPrice !== s.unitPrice * s.quantity)) throw new Error('Chi tiết dịch vụ không hợp lệ.');
      }
      if (field === 'debts' && (row.paymentHistory as Record<string, unknown>[]).some(p => !p || typeof p.date !== 'string' || typeof p.time !== 'string' || typeof p.method !== 'string' || typeof p.amount !== 'number' || !Number.isSafeInteger(p.amount) || p.amount <= 0)) throw new Error('Lịch sử thu nợ không hợp lệ.');
      if ((field === 'stays' || field === 'reservations') && row.companionGuests !== undefined && (!Array.isArray(row.companionGuests) || row.companionGuests.some(g => !g || typeof g.id !== 'string' || typeof g.name !== 'string'))) throw new Error('Danh sách khách không hợp lệ.');
    }
  }
  const result = input as HotelData;
  return { ...result, rooms: result.rooms.map(roomDefaults) };
}
export function readHotelData(storage: Pick<Storage, 'getItem'>, defaults: HotelData): { data: HotelData; error: string } {
  try {
    const saved = storage.getItem(DATA_KEY);
    if (saved) {
      const snapshot = JSON.parse(saved);
      if (snapshot.version !== 3) throw new Error('Phiên bản dữ liệu không được hỗ trợ.');
      return { data: validateHotelData(snapshot.data), error: '' };
    }
    const legacy = Object.fromEntries(fields.map(field => {
      const raw = storage.getItem(`son_ngoc_hotel_${field}_v2`);
      return [field, raw ? JSON.parse(raw) : defaults[field]];
    }));
    return { data: validateHotelData(legacy), error: '' };
  } catch {
    // Keep the original storage untouched; recovery is through a validated backup.
    return { data: { rooms: [], services: [], stays: [], reservations: [], invoices: [], debts: [] }, error: 'Không đọc được dữ liệu đã lưu. Dữ liệu gốc được giữ lại; hãy tải bản sao lưu hoặc liên hệ hỗ trợ trước khi nhập thêm.' };
  }
}
export function serializeHotelData(data: HotelData): string {
  return JSON.stringify({ version: 3, savedAt: new Date().toISOString(), data });
}
