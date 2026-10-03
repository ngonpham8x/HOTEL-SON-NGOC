import type { DebtRecord, Invoice, ServiceItem } from '../types/hotel';
import { dateTime, localDate, localTime, money, newId } from './hotelLogic';

export interface ServiceSaleInput {
  customerName: string;
  phone: string;
  items: { serviceId: string; quantity: number }[];
  discount: number;
  paidAmount: number;
  paymentMethod: 'CASH' | 'TRANSFER' | 'CARD';
  dueDate?: string;
  notes?: string;
}

export function prepareServiceSale(input: ServiceSaleInput, catalog: ServiceItem[], now = new Date()): { invoice: Invoice; debt?: DebtRecord } {
  if (!input.items.length) throw new Error('Chọn ít nhất một vé hoặc dịch vụ.');
  if (!['CASH', 'TRANSFER', 'CARD'].includes(input.paymentMethod)) throw new Error('Phương thức thanh toán không hợp lệ.');
  const date = localDate(now), time = localTime(now), timestamp = `${date} ${time}`;
  const used = new Set<string>();
  const services = input.items.map(item => {
    const service = catalog.find(s => s.id === item.serviceId);
    if (!service || used.has(item.serviceId) || !Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new Error('Dịch vụ hoặc số lượng không hợp lệ.');
    used.add(item.serviceId);
    money(service.price, 'Đơn giá');
    const totalPrice = money(service.price * item.quantity, 'Thành tiền');
    return { id: newId(), serviceId: service.id, name: service.name, category: service.category, quantity: item.quantity, unitPrice: service.price, totalPrice, timestamp };
  });
  const serviceCharge = money(services.reduce((sum, item) => sum + item.totalPrice, 0), 'Tổng tiền');
  const discount = money(input.discount, 'Giảm giá'), paidAmount = money(input.paidAmount, 'Tiền đã thu');
  if (discount > serviceCharge) throw new Error('Giảm giá vượt tổng tiền dịch vụ.');
  const totalAmount = serviceCharge - discount;
  if (paidAmount > totalAmount) throw new Error('Tiền đã thu vượt số tiền cần thanh toán.');
  const debtAmount = totalAmount - paidAmount;
  if (debtAmount && (!input.customerName.trim() || !input.phone.trim())) throw new Error('Ghi nợ cần tên và số điện thoại khách hàng.');
  if (debtAmount && input.dueDate && (!Number.isFinite(dateTime(input.dueDate, '12:00')) || input.dueDate < date)) throw new Error('Ngày hẹn thu nợ không hợp lệ.');
  const id = newId(), customerName = input.customerName.trim() || 'Khách lẻ', phone = input.phone.trim();
  const invoice: Invoice = {
    id, kind: 'SERVICE', code: `DV-${id.slice(0, 8).toUpperCase()}`, stayId: `SALE-${id}`, roomNumber: 'Khách ngoài', customerName, phone,
    checkInDateTime: timestamp, checkOutDateTime: timestamp, durationNightsOrHours: 0, pricingType: 'NIGHT', roomCharge: 0,
    serviceCharge, massageCharge: services.filter(s => s.category === 'MASSAGE').reduce((sum, s) => sum + s.totalPrice, 0), services,
    surcharge: 0, discount, depositDeducted: 0, totalAmount, paidAmount, debtAmount, paymentMethod: input.paymentMethod,
    status: debtAmount === 0 ? 'PAID' : paidAmount ? 'PARTIAL' : 'DEBT', date, time, notes: input.notes,
  };
  const due = new Date(now); due.setDate(due.getDate() + 7);
  const debt: DebtRecord | undefined = debtAmount ? {
    id: newId(), invoiceId: id, invoiceCode: invoice.code, customerName, phone, roomNumber: 'Khách ngoài', createdDate: date,
    dueDate: input.dueDate || localDate(due), totalInvoiceAmount: totalAmount, originalDebt: debtAmount,
    paidAmount: 0, remainingAmount: debtAmount, status: 'UNPAID', paymentHistory: [], notes: input.notes,
  } : undefined;
  return { invoice, debt };
}
