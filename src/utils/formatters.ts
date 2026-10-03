export const formatCurrency = (amount: number): string => {
  if (isNaN(amount) || amount === null || amount === undefined) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount).replace('₫', '₫');
};

export const formatNumber = (num: number): string => {
  if (isNaN(num) || num === null || num === undefined) return '0';
  return new Intl.NumberFormat('vi-VN').format(num);
};

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const [year, month, day] = dateStr.split('-');
    if (year && month && day) {
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
};

export const formatDateTime = (dateStr: string, timeStr?: string): string => {
  const d = formatDate(dateStr);
  return timeStr ? `${timeStr}, ${d}` : d;
};

export const getRoomStatusMeta = (status: string) => {
  switch (status) {
    case 'AVAILABLE':
      return { label: 'Phòng trống', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    case 'OCCUPIED':
      return { label: 'Đang có khách', color: 'text-rose-700 bg-rose-50 border-rose-200' };
    case 'RESERVED':
      return { label: 'Đã đặt trước', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    case 'CLEANING':
      return { label: 'Đang dọn dẹp', color: 'text-blue-700 bg-blue-50 border-blue-200' };
    case 'MAINTENANCE':
      return { label: 'Bảo trì', color: 'text-slate-600 bg-slate-100 border-slate-300' };
    default:
      return { label: status, color: 'text-slate-700 bg-slate-50 border-slate-200' };
  }
};

export const getDebtStatusMeta = (status: string) => {
  switch (status) {
    case 'UNPAID':
      return { label: 'Chưa thanh toán', color: 'text-rose-700 bg-rose-50 border-rose-200' };
    case 'PARTIAL':
      return { label: 'Đã trả một phần', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    case 'SETTLED':
      return { label: 'Đã thanh toán đủ', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    case 'OVERDUE':
      return { label: 'Quá hạn thu nợ', color: 'text-red-800 bg-red-100 border-red-300' };
    default:
      return { label: status, color: 'text-slate-700 bg-slate-50 border-slate-200' };
  }
};

export const getPaymentMethodName = (method: string): string => {
  switch (method) {
    case 'CASH':
      return 'Tiền mặt';
    case 'TRANSFER':
      return 'Chuyển khoản (QR)';
    case 'CARD':
      return 'Thẻ ngân hàng';
    case 'DEBT':
      return 'Ghi nợ';
    case 'MIXED':
      return 'Kết hợp';
    default:
      return method;
  }
};
