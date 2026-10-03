export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING' | 'MAINTENANCE';
export type RoomType = 'STANDARD_SINGLE' | 'STANDARD_DOUBLE' | 'DELUXE' | 'SUITE' | 'VIP';
export type CleanStatus = 'CLEAN' | 'DIRTY';

export interface Room {
  id: string;
  number: string;
  floor: number;
  type: RoomType;
  typeName: string;
  pricePerNight: number;
  pricePerHour: number;
  allowsHourly?: boolean;
  defaultCheckInTime?: string;
  defaultCheckOutTime?: string;
  maxGuests: number;
  status: RoomStatus;
  cleanStatus: CleanStatus;
  amenities: string[];
  currentStayId?: string;
  currentGuestName?: string;
  notes?: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  category: 'MASSAGE' | 'MINIBAR' | 'LAUNDRY' | 'FOOD_BEVERAGE' | 'RENTAL' | 'OTHER';
  categoryName: string;
  price: number;
  unit: string;
}

export interface ServiceUsage {
  category?: ServiceItem['category'];
  id: string;
  serviceId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  timestamp: string;
}

export interface CompanionGuest {
  id: string;
  name: string;
  idCard?: string;
  birthYear?: string;
  gender?: 'NAM' | 'NU' | 'KHAC';
  relationship?: string;
  phone?: string;
  notes?: string;
}

export type ReservationStatus = 'CONFIRMED' | 'CHECKED_IN' | 'CANCELLED';

export interface Reservation {
  pricingType?: 'NIGHT' | 'HOUR';
  rateApplied?: number;
  id: string;
  code: string;
  customerName: string;
  phone: string;
  idCard: string;
  checkInDate: string; // YYYY-MM-DD
  checkInTime: string; // HH:mm
  checkOutDate: string; // YYYY-MM-DD
  checkOutTime: string; // HH:mm
  roomId: string;
  roomNumber: string;
  roomType: string;
  guestsCount: number;
  companionGuests?: CompanionGuest[]; // Danh sách khách đi cùng phòng (2, 3, 4, 5+ người)
  depositAmount: number;
  estimatedTotal: number;
  status: ReservationStatus;
  notes?: string;
  createdAt: string;
}

export type StayStatus = 'ACTIVE' | 'CHECKED_OUT';

export interface StayRecord {
  id: string;
  code: string;
  roomId: string;
  roomNumber: string;
  customerName: string;
  phone: string;
  idCard: string;
  companionGuests?: CompanionGuest[]; // Danh sách khách đi cùng phòng (2, 3, 4, 5+ người)
  checkInDate: string; // YYYY-MM-DD
  checkInTime: string; // HH:mm
  expectedCheckOutDate: string;
  expectedCheckOutTime: string;
  actualCheckOutDate?: string;
  actualCheckOutTime?: string;
  pricingType: 'NIGHT' | 'HOUR';
  rateApplied: number;
  deposit: number;
  services: ServiceUsage[];
  status: StayStatus;
  notes?: string;
}

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'CARD' | 'DEBT' | 'MIXED';
export type InvoiceStatus = 'PAID' | 'PARTIAL' | 'DEBT';

export interface Invoice {
  kind?: 'ROOM' | 'SERVICE';
  id: string;
  code: string;
  stayId: string;
  roomNumber: string;
  customerName: string;
  phone: string;
  checkInDateTime: string;
  checkOutDateTime: string;
  durationNightsOrHours: number;
  pricingType: 'NIGHT' | 'HOUR';
  roomCharge: number;
  serviceCharge: number;
  massageCharge?: number; // Doanh thu vé Massage thư giãn
  services?: ServiceUsage[]; // Danh sách dịch vụ & vé massage đã dùng
  surcharge: number; // Phụ thu quá giờ/ngày lễ
  discount: number;
  depositDeducted: number;
  refundAmount?: number;
  totalAmount: number; // Sau khi trừ cọc
  paidAmount: number;
  debtAmount: number;
  paymentMethod: PaymentMethod;
  status: InvoiceStatus;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  notes?: string;
}

export interface DebtPayment {
  id: string;
  date: string;
  time: string;
  amount: number;
  method: PaymentMethod;
  collectedBy: string;
  notes?: string;
}

export type DebtStatus = 'UNPAID' | 'PARTIAL' | 'SETTLED' | 'OVERDUE';

export interface DebtRecord {
  id: string;
  invoiceId: string;
  invoiceCode: string;
  customerName: string;
  phone: string;
  roomNumber: string;
  createdDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  totalInvoiceAmount: number;
  originalDebt: number;
  paidAmount: number;
  remainingAmount: number;
  status: DebtStatus;
  paymentHistory: DebtPayment[];
  notes?: string;
}

export interface DayRevenueStat {
  date: string;
  roomRevenue: number;
  serviceRevenue: number;
  surchargeRevenue: number;
  totalRevenue: number;
  cashCollected: number;
  transferCollected: number;
  debtIncurred: number;
  invoicesCount: number;
  occupancyRate: number; // 0 - 100
}

export interface MonthSummary {
  monthKey: string; // e.g., '2026-10'
  monthLabel: string;
  totalRevenue: number;
  roomRevenue: number;
  serviceRevenue: number;
  surchargeRevenue: number;
  totalCheckIns: number;
  totalGuests: number;
  averageOccupancy: number; // %
  adr: number; // Average Daily Rate (VND)
  revPar: number; // Revenue Per Available Room (VND)
  collectedAmount: number;
  debtIncurred: number;
  dailyStats: DayRevenueStat[];
}
