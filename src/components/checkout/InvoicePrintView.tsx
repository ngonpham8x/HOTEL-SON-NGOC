import React from 'react';
import { HotelLogo } from '../common/HotelLogo';
import { Invoice } from '../../types/hotel';
import { useAccess } from '../../context/AccessContext';
import { formatCurrency, formatDate, getPaymentMethodName } from '../../utils/formatters';
import { Printer, X, Building2 } from 'lucide-react';

interface InvoicePrintViewProps {
  invoice: Invoice;
  onClose: () => void;
}

export const InvoicePrintView: React.FC<InvoicePrintViewProps> = ({ invoice, onClose }) => {
  const { canAct } = useAccess();
  const canPrint = canAct('data.export') || canAct(invoice.kind === 'SERVICE' ? 'sale.create' : 'stay.checkout');
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="invoice-dialog fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="no-print px-3 sm:px-6 py-3.5 bg-slate-900 text-white flex flex-wrap gap-2 items-center justify-between shrink-0">
          <span className="text-xs font-semibold">Phiếu thu thanh toán - {invoice.code}</span>
          <div className="flex items-center gap-2">
            {canPrint && <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In phiếu thu / Lưu PDF</span>
            </button>}
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Container */}
        <div className="p-3 sm:p-8 overflow-y-auto min-h-0 space-y-6 flex-1 text-slate-900 text-xs bg-white print-container">
          {/* Hotel Header */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start border-b border-slate-300 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <HotelLogo size="sm" />
                <h2 className="text-base font-extrabold tracking-tight uppercase text-emerald-950">
                  Hotel Sơn Ngọc
                </h2>
              </div>
              <p className="text-slate-600 mt-0.5">Địa chỉ: Số 70 Quốc lộ 20, xã Hòa Ninh, Lâm Đồng</p>
              <p className="text-emerald-800 font-semibold mt-0.5">Hotline: 0392.089.960 (Ms Trinh) · Email: sonngochotel@gmail.com</p>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold font-mono tracking-tight text-slate-900 block">
                {invoice.code}
              </span>
              <span className="text-slate-500 block">Ngày: {formatDate(invoice.date)} {invoice.time}</span>
              <span className="mt-1 inline-block px-2 py-0.5 rounded font-semibold text-[10px] bg-slate-100 text-slate-700 uppercase">
                {invoice.status === 'PAID' ? 'Đã thanh toán đủ' : invoice.status === 'PARTIAL' ? 'Thanh toán một phần' : 'Ghi nợ'}
              </span>
            </div>
          </div>

          {/* Invoice Title */}
          <div className="text-center py-1">
            <h1 className="text-base font-bold uppercase tracking-wider text-slate-900">
              PHIẾU THU THANH TOÁN DỊCH VỤ
            </h1>
            <p className="text-slate-500 text-[11px]">Guest Folio & Receipt</p>
          </div>

          {/* Customer & Room Info */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <div>
              <p><strong className="text-slate-700">Khách hàng:</strong> {invoice.customerName}</p>
              <p className="mt-1"><strong className="text-slate-700">Số điện thoại:</strong> {invoice.phone || 'Chưa lưu'}</p>
            </div>
            <div className="text-right">
              <p><strong className="text-slate-700">{invoice.kind === 'SERVICE' ? 'Loại phiếu thu:' : 'Phòng:'}</strong> <span className="font-bold font-mono text-emerald-800 text-sm">{invoice.kind === 'SERVICE' ? 'Dịch vụ khách ngoài' : `Phòng ${invoice.roomNumber}`}</span></p>
              <p className="mt-1 text-slate-500 text-[11px]">
                {invoice.checkInDateTime} → {invoice.checkOutDateTime}
              </p>
            </div>
          </div>

          {/* Items Table */}
          <p className="sm:hidden no-print text-[11px] text-slate-500">Vuốt ngang bảng để xem đủ các khoản tiền.</p>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[400px] text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300 text-[11px] uppercase font-bold text-slate-700">
                <th className="py-2">Khoản mục</th>
                <th className="py-2 text-center">SL / ĐVT</th>
                <th className="py-2 text-right">Đơn giá</th>
                <th className="py-2 text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoice.kind !== 'SERVICE' && <tr>
                <td className="py-2.5 font-medium">Tiền phòng ({invoice.pricingType === 'NIGHT' ? 'theo đêm' : 'theo giờ'})</td>
                <td className="py-2.5 text-center font-mono">{invoice.durationNightsOrHours} {invoice.pricingType === 'NIGHT' ? 'đêm' : 'h'}</td>
                <td className="py-2.5 text-right font-mono">{formatCurrency(invoice.durationNightsOrHours ? invoice.roomCharge / invoice.durationNightsOrHours : 0)}</td>
                <td className="py-2.5 text-right font-mono font-semibold">{formatCurrency(invoice.roomCharge)}</td>
              </tr>}
              {invoice.services?.length ? invoice.services.map(item => <tr key={item.id}><td className="py-2.5 font-medium">{item.name}</td><td className="py-2.5 text-center font-mono">{item.quantity}</td><td className="py-2.5 text-right font-mono">{formatCurrency(item.unitPrice)}</td><td className="py-2.5 text-right font-mono font-semibold">{formatCurrency(item.totalPrice)}</td></tr>) : invoice.serviceCharge > 0 && (
                <tr>
                  <td className="py-2.5 font-medium">Minibar, Nước giải khát & Dịch vụ</td>
                  <td className="py-2.5 text-center">Trọn gói</td>
                  <td className="py-2.5 text-right font-mono">{formatCurrency(invoice.serviceCharge)}</td>
                  <td className="py-2.5 text-right font-mono font-semibold">{formatCurrency(invoice.serviceCharge)}</td>
                </tr>
              )}
              {invoice.surcharge > 0 && (
                <tr>
                  <td className="py-2.5 font-medium">Phụ thu (check-out trễ / người phát sinh)</td>
                  <td className="py-2.5 text-center">---</td>
                  <td className="py-2.5 text-right font-mono">{formatCurrency(invoice.surcharge)}</td>
                  <td className="py-2.5 text-right font-mono font-semibold">{formatCurrency(invoice.surcharge)}</td>
                </tr>
              )}
              {invoice.discount > 0 && (
                <tr className="text-rose-600">
                  <td className="py-2.5 font-medium">Chiết khấu / Giảm trừ</td>
                  <td className="py-2.5 text-center">---</td>
                  <td className="py-2.5 text-right font-mono">- {formatCurrency(invoice.discount)}</td>
                  <td className="py-2.5 text-right font-mono font-semibold">- {formatCurrency(invoice.discount)}</td>
                </tr>
              )}
              {invoice.depositDeducted > 0 && (
                <tr className="text-emerald-700">
                  <td className="py-2.5 font-medium">Khấu trừ tiền cọc trước</td>
                  <td className="py-2.5 text-center">Đã thu</td>
                  <td className="py-2.5 text-right font-mono">- {formatCurrency(invoice.depositDeducted)}</td>
                  <td className="py-2.5 text-right font-mono font-semibold">- {formatCurrency(invoice.depositDeducted)}</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>

          {/* Totals Summary */}
          <div className="border-t-2 border-slate-900 pt-3 space-y-1.5 text-right">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-700">Tổng thanh toán:</span>
              <span className="font-bold font-mono text-sm text-slate-900">
                {formatCurrency(invoice.totalAmount)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Đã thanh toán ({getPaymentMethodName(invoice.paymentMethod)}):</span>
              <span className="font-mono font-semibold text-emerald-700">
                {formatCurrency(invoice.paidAmount)}
              </span>
            </div>
            {invoice.debtAmount > 0 && (
              <div className="flex justify-between text-xs text-rose-700">
                <span className="font-bold">Ghi nhận công nợ còn lại:</span>
                <span className="font-bold font-mono text-sm">
                  {formatCurrency(invoice.debtAmount)}
                </span>
              </div>
            )}
          </div>

          {(invoice.refundAmount || 0) > 0 && <p className="font-bold text-amber-800">Tiền cọc hoàn lại: {formatCurrency(invoice.refundAmount || 0)}</p>}
          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-8 text-center border-t border-slate-200">
            <div>
              <p className="font-semibold text-slate-800">Khách hàng</p>
              <p className="text-[11px] text-slate-400 italic">(Ký và ghi rõ họ tên)</p>
              <div className="h-14"></div>
              <p className="font-semibold text-slate-700">{invoice.customerName}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-800">Thu ngân / Lễ tân</p>
              <p className="text-[11px] text-slate-400 italic">(Ký và đóng dấu)</p>
              <div className="h-14"></div>
              <p className="font-semibold text-slate-700"></p>
            </div>
          </div>

          <p className="text-center text-[10px] text-slate-400 pt-4 border-t border-slate-100">
            Cảm ơn quý khách đã tin tưởng và lựa chọn Hotel Sơn Ngọc! Hotline hỗ trợ: 0392.089.960 Ms Trinh. Chúc quý khách thượng lộ bình an!
          </p>
        </div>
      </div>
    </div>
  );
};
