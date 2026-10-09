import React, { useState } from 'react';
import { useHotel } from '../../context/HotelContext';
import type { Invoice } from '../../types/hotel';
import { formatCurrency, formatDate, getPaymentMethodName } from '../../utils/formatters';
import { invoiceRevenue, invoiceCollected } from '../../utils/hotelLogic';
import { EditServiceSaleModal } from '../modals/EditServiceSaleModal';
import { EditRoomInvoiceModal } from '../modals/EditRoomInvoiceModal';
import { InvoicePrintView } from '../checkout/InvoicePrintView';
import {
  Printer,
  Edit2,
  Trash2,
  Ban,
  User,
  Phone,
  DoorOpen,
  Clock,
  Calendar,
  AlertCircle,
  Receipt,
  CreditCard,
} from 'lucide-react';

interface InvoiceListTableProps {
  invoices: Invoice[];
  emptyMessage?: string;
  showDateColumn?: boolean;
  maxHeightClass?: string;
}

export const InvoiceListTable: React.FC<InvoiceListTableProps> = ({
  invoices,
  emptyMessage = 'Không có phiếu thu nào phát sinh',
  showDateColumn = false,
  maxHeightClass,
}) => {
  const {
    cancelServiceSale,
    cancelRoomInvoice,
    deleteInvoice,
    clearCancelledInvoices,
    requestConfirm,
    showToast,
  } = useHotel();

  const [editingServiceInvoice, setEditingServiceInvoice] = useState<Invoice | null>(null);
  const [editingRoomInvoice, setEditingRoomInvoice] = useState<Invoice | null>(null);
  const [printingInvoice, setPrintingInvoice] = useState<Invoice | null>(null);

  const handleEdit = (inv: Invoice) => {
    if (inv.status === 'CANCELLED') {
      showToast('Phiếu thu này đã bị hủy, không thể chỉnh sửa.', 'warning');
      return;
    }
    if (inv.kind === 'SERVICE') {
      setEditingServiceInvoice(inv);
    } else {
      setEditingRoomInvoice(inv);
    }
  };

  const handleDelete = (inv: Invoice) => {
    if (inv.status === 'CANCELLED') {
      showToast('Phiếu thu này đã ở trạng thái hủy.', 'info');
      return;
    }

    requestConfirm({
      title: `Xác nhận hủy phiếu thu ${inv.code}?`,
      message: `Bạn có chắc chắn muốn hủy phiếu thu ${inv.code} (${inv.customerName}) không? Doanh thu ${formatCurrency(invoiceRevenue(inv))} của phiếu thu này sẽ được điều chỉnh về 0 và chuyển sang trạng thái ĐÃ HỦY.`,
      confirmLabel: 'Xác nhận hủy giao dịch',
      cancelLabel: 'Đóng',
      isDanger: true,
      onConfirm: async () => {
        try {
          if (inv.kind === 'SERVICE') {
            await cancelServiceSale(inv.id);
          } else {
            await cancelRoomInvoice(inv.id);
          }
          showToast(`Đã hủy phiếu thu ${inv.code} thành công.`, 'success');
        } catch (error) {
          showToast(error instanceof Error ? error.message : 'Không thể hủy phiếu thu.', 'error');
        }
      },
    });
  };

  const handlePermanentDelete = (inv: Invoice) => {
    requestConfirm({
      title: `Xóa vĩnh viễn phiếu thu ${inv.code}?`,
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn phiếu thu test ${inv.code} (${inv.customerName}) khỏi hệ thống? Dữ liệu này sẽ được xóa hoàn toàn và không thể khôi phục.`,
      confirmLabel: 'Xác nhận xóa vĩnh viễn',
      cancelLabel: 'Đóng',
      isDanger: true,
      onConfirm: async () => {
        try {
          await deleteInvoice(inv.id);
        } catch (error) {
          showToast(error instanceof Error ? error.message : 'Không thể xóa phiếu thu.', 'error');
        }
      },
    });
  };

  const cancelledCount = invoices.filter(i => i.status === 'CANCELLED').length;

  const handleClearAllCancelled = () => {
    requestConfirm({
      title: `Xóa sạch ${cancelledCount} phiếu thu đã hủy / test?`,
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn toàn bộ ${cancelledCount} phiếu thu đã hủy hoặc test trước đó khỏi hệ thống? Thao tác này sẽ dọn dẹp sạch danh sách.`,
      confirmLabel: 'Xóa sạch tất cả',
      cancelLabel: 'Đóng',
      isDanger: true,
      onConfirm: async () => {
        try {
          await clearCancelledInvoices();
        } catch (error) {
          showToast(error instanceof Error ? error.message : 'Không thể xóa phiếu thu đã hủy.', 'error');
        }
      },
    });
  };

  if (invoices.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
        <Receipt className="w-8 h-8 text-slate-300 stroke-1" />
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <>
      {/* Thanh thông báo & nút dọn dẹp phiếu đã hủy / test */}
      {cancelledCount > 0 && (
        <div className="flex items-center justify-between px-3.5 py-2 bg-amber-50/80 border-b border-amber-200/70 text-xs">
          <div className="flex items-center gap-1.5 text-amber-900 font-medium">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Có <strong>{cancelledCount}</strong> phiếu thu đã hủy / test.</span>
          </div>
          <button
            type="button"
            onClick={handleClearAllCancelled}
            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors shadow-xs"
            title="Xóa sạch toàn bộ phiếu thu đã hủy / test"
          >
            <Trash2 className="w-3 h-3" />
            <span>Xóa sạch phiếu đã hủy ({cancelledCount})</span>
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* 1. GIAO DIỆN MOBILE (< sm): DẠNG THẺ (CARD VIEW) CUỘN DỌC MƯỢT MÀ */}
      {/* =================================================================== */}
      <div className={`block sm:hidden divide-y divide-slate-100 ${maxHeightClass || ''} overflow-y-auto`}>
        {invoices.map(inv => {
          const isCancelled = inv.status === 'CANCELLED';
          const rev = invoiceRevenue(inv);
          const collected = invoiceCollected(inv);

          return (
            <div
              key={inv.id}
              className={`p-3.5 space-y-2.5 transition-colors ${
                isCancelled ? 'bg-slate-50/80 opacity-75' : 'bg-white hover:bg-slate-50'
              }`}
            >
              {/* Header dòng 1: Mã PT, Ngày/giờ, Badge trạng thái */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {inv.code}
                  </span>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {inv.time}
                    {showDateColumn && ` · ${formatDate(inv.date).slice(0, 5)}`}
                  </span>
                </div>

                <div>
                  {isCancelled ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600">
                      Đã hủy
                    </span>
                  ) : inv.debtAmount > 0 ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                      Ghi nợ
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Đã thu đủ
                    </span>
                  )}
                </div>
              </div>

              {/* Thông tin phòng & Khách hàng */}
              <div className="flex items-start justify-between gap-2 text-xs">
                <div>
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{inv.customerName}</span>
                    {inv.phone && (
                      <span className="text-[11px] font-mono text-slate-500 font-normal">
                        ({inv.phone})
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-semibold text-teal-800 flex items-center gap-1 mt-0.5">
                    <DoorOpen className="w-3 h-3 text-teal-600" />
                    {inv.kind === 'SERVICE' ? 'Khách ngoài' : `Phòng ${inv.roomNumber}`}
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600 font-normal">
                      {getPaymentMethodName(inv.paymentMethod)}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[10px] text-slate-500">Tổng cộng</div>
                  <div className="font-mono font-bold text-sm text-slate-900">
                    {formatCurrency(rev)}
                  </div>
                </div>
              </div>

              {/* Chi tiết số tiền & Đã thu */}
              <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-50 rounded-lg text-[11px] border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px]">Tiền phòng</span>
                  <span className="font-mono text-slate-700 font-medium">
                    {formatCurrency(isCancelled ? 0 : inv.roomCharge)}
                  </span>
                </div>
                <div>
                  <span className="text-teal-600 block text-[10px]">Vé Massage</span>
                  <span className="font-mono text-teal-700 font-bold">
                    {formatCurrency(isCancelled ? 0 : (inv.massageCharge || 0))}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-emerald-600 block text-[10px]">Thực thu</span>
                  <span className="font-mono text-emerald-700 font-bold">
                    {formatCurrency(collected)}
                  </span>
                </div>
              </div>

              {inv.debtAmount > 0 && !isCancelled && (
                <div className="text-[11px] font-mono text-rose-700 bg-rose-50 px-2 py-1 rounded flex items-center justify-between">
                  <span>Còn nợ:</span>
                  <span className="font-bold">{formatCurrency(inv.debtAmount)}</span>
                </div>
              )}

              {/* Hàng nút thao tác Mobile: In, Sửa, Hủy GD, Xóa vĩnh viễn */}
              <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100 flex-wrap">
                <button
                  type="button"
                  onClick={() => setPrintingInvoice(inv)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                  title="In phiếu thu"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>In</span>
                </button>

                {!isCancelled && (
                  <button
                    type="button"
                    onClick={() => handleEdit(inv)}
                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    title="Sửa thông tin phiếu thu"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Sửa</span>
                  </button>
                )}

                {!isCancelled && (
                  <button
                    type="button"
                    onClick={() => handleDelete(inv)}
                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    title="Hủy giao dịch (doanh thu về 0)"
                  >
                    <Ban className="w-3.5 h-3.5 text-amber-600" />
                    <span>Hủy</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handlePermanentDelete(inv)}
                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border border-rose-200/60"
                  title={isCancelled ? 'Xóa vĩnh viễn phiếu thu đã hủy' : 'Xóa vĩnh viễn phiếu test khỏi hệ thống'}
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Xóa</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* 2. GIAO DIỆN DESKTOP / TABLET (>= sm): BẢNG CHUẨN CÓ OVERFLOW-X-AUTO */}
      {/* =================================================================== */}
      <div className={`hidden sm:block overflow-x-auto touch-pan-x ${maxHeightClass || ''}`}>
        <table className="w-full text-left text-xs min-w-[880px] border-collapse">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 sticky top-0 z-10">
            <tr>
              {showDateColumn && <th className="px-3.5 py-2.5">Ngày</th>}
              <th className="px-3.5 py-2.5">Mã PT</th>
              <th className="px-3.5 py-2.5">Phòng</th>
              <th className="px-3.5 py-2.5">Khách hàng</th>
              <th className="px-3.5 py-2.5 text-right">Tiền phòng</th>
              <th className="px-3.5 py-2.5 text-right">Vé Massage</th>
              <th className="px-3.5 py-2.5 text-right">Minibar/DV</th>
              <th className="px-3.5 py-2.5 text-right">Tổng cộng</th>
              <th className="px-3.5 py-2.5 text-right">Đã thu</th>
              <th className="px-3.5 py-2.5 text-right">Ghi nợ</th>
              <th className="px-3.5 py-2.5 text-center">Hình thức</th>
              <th className="px-3.5 py-2.5 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map(inv => {
              const isCancelled = inv.status === 'CANCELLED';
              const rev = invoiceRevenue(inv);
              const collected = invoiceCollected(inv);

              return (
                <tr
                  key={inv.id}
                  className={`hover:bg-slate-50 transition-colors ${
                    isCancelled ? 'bg-slate-50/70 text-slate-400' : ''
                  }`}
                >
                  {showDateColumn && (
                    <td className="px-3.5 py-2.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {formatDate(inv.date).slice(0, 5)}
                    </td>
                  )}
                  <td className="px-3.5 py-2.5 font-mono font-semibold text-slate-900 whitespace-nowrap">
                    {inv.code}
                    <span className="block text-[10px] text-slate-400 font-normal">
                      {inv.time}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 font-bold font-mono text-teal-800 whitespace-nowrap">
                    {inv.kind === 'SERVICE' ? 'Khách ngoài' : `P.${inv.roomNumber}`}
                  </td>
                  <td className="px-3.5 py-2.5 font-semibold text-slate-800 whitespace-nowrap max-w-[150px] truncate">
                    {inv.customerName}
                    {inv.phone && (
                      <span className="block text-[10px] text-slate-400 font-mono font-normal">
                        {inv.phone}
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono text-slate-700 whitespace-nowrap">
                    {formatCurrency(isCancelled ? 0 : inv.roomCharge)}
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono font-bold text-teal-700 whitespace-nowrap">
                    {formatCurrency(isCancelled ? 0 : (inv.massageCharge || 0))}
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono text-slate-700 whitespace-nowrap">
                    {formatCurrency(isCancelled ? 0 : (inv.serviceCharge + inv.surcharge))}
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                    {formatCurrency(rev)}
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono text-emerald-700 font-semibold whitespace-nowrap">
                    {formatCurrency(collected)}
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono text-rose-700 font-semibold whitespace-nowrap">
                    {inv.debtAmount > 0 && !isCancelled ? formatCurrency(inv.debtAmount) : '-'}
                  </td>
                  <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                    {isCancelled ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600">
                        Đã hủy
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {getPaymentMethodName(inv.paymentMethod)}
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPrintingInvoice(inv)}
                        className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded-md transition-colors"
                        title="In phiếu thu"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>

                      {!isCancelled && (
                        <button
                          type="button"
                          onClick={() => handleEdit(inv)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                          title="Sửa thông tin phiếu thu"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {!isCancelled && (
                        <button
                          type="button"
                          onClick={() => handleDelete(inv)}
                          className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors"
                          title="Hủy giao dịch (doanh thu về 0)"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handlePermanentDelete(inv)}
                        className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-md transition-colors"
                        title={isCancelled ? 'Xóa vĩnh viễn phiếu thu đã hủy' : 'Xóa vĩnh viễn phiếu test khỏi hệ thống'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODALS */}
      {editingServiceInvoice && (
        <EditServiceSaleModal
          invoice={editingServiceInvoice}
          onClose={() => setEditingServiceInvoice(null)}
        />
      )}

      {editingRoomInvoice && (
        <EditRoomInvoiceModal
          invoice={editingRoomInvoice}
          onClose={() => setEditingRoomInvoice(null)}
        />
      )}

      {printingInvoice && (
        <InvoicePrintView
          invoice={printingInvoice}
          onClose={() => setPrintingInvoice(null)}
        />
      )}
    </>
  );
};
