import React, { useState, lazy, Suspense } from 'react';
import { HotelProvider, useHotel } from './context/HotelContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { HomeDashboard } from './components/dashboard/HomeDashboard';
import { RoomRackView } from './components/rooms/RoomRackView';
import { RoomDetailModal } from './components/rooms/RoomDetailModal';
import { RoomEditModal } from './components/modals/RoomEditModal';
import { CheckInModal } from './components/modals/CheckInModal';
import { BookingModal } from './components/modals/BookingModal';
import { CheckOutModal } from './components/checkout/CheckOutModal';
import { InvoicePrintView } from './components/checkout/InvoicePrintView';
import { NotificationOverlay } from './components/common/NotificationOverlay';
import { ReservationList } from './components/reservations/ReservationList';
import { ActiveStayManager } from './components/stays/ActiveStayManager';
import { DebtManagement } from './components/debt/DebtManagement';
import { Room, Invoice } from './types/hotel';
import { AuthGate } from './components/auth/AuthGate';
import { CloudAuthGate } from './components/auth/CloudAuthGate';
import { cloudEnabled } from './utils/cloudHotel';

const AnalyticsDashboard = lazy(() => import('./components/analytics/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })));
const ExportReportView = lazy(() => import('./components/reports/ExportReportView').then(m => ({ default: m.ExportReportView })));
const ServiceCatalogView = lazy(() => import('./components/services/ServiceCatalogView').then(m => ({ default: m.ServiceCatalogView })));
const ServiceSalesView = lazy(() => import('./components/services/ServiceSalesView').then(m => ({ default: m.ServiceSalesView })));

const MainLayout: React.FC<{ onLogout: () => void; onPasswordChanged: () => void }> = ({ onLogout, onPasswordChanged }) => {
  const { activeTab, storageError, rooms } = useHotel();

  // Modal States
  const [detailRoom, setDetailRoom] = useState<Room | null>(null);
  const [checkInRoom, setCheckInRoom] = useState<Room | null>(null);
  const [isQuickCheckInOpen, setIsQuickCheckInOpen] = useState<boolean>(false);
  const [checkOutRoom, setCheckOutRoom] = useState<Room | null>(null);
  const [bookingRoom, setBookingRoom] = useState<Room | null>(null);
  const [isQuickBookingOpen, setIsQuickBookingOpen] = useState<boolean>(false);
  const [printedInvoice, setPrintedInvoice] = useState<Invoice | null>(null);

  // Room Edit / Add CRUD State: undefined = closed, null = add new, Room = edit
  const [editingRoom, setEditingRoom] = useState<Room | null | undefined>(undefined);

  return (
    <div className={`${printedInvoice ? 'invoice-open' : ''} min-h-screen bg-[#e4f3f4] flex flex-col font-sans text-slate-800 selection:bg-teal-200 selection:text-teal-950`}>
      {/* Top Header */}
      <Header
        onOpenQuickCheckIn={() => setIsQuickCheckInOpen(true)}
        onOpenQuickBooking={() => setIsQuickBookingOpen(true)}
        onOpenAddRoom={() => setEditingRoom(null)}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar onLogout={onLogout} onPasswordChanged={onPasswordChanged} />

        {/* Main Content Viewport */}
        <main className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-5 md:p-7 max-w-7xl mx-auto w-full">
          <Suspense fallback={<p role="status" className="p-4 text-sm text-teal-800">Đang mở trang…</p>}>
          <div role="alert" className={storageError ? "no-print mb-4 p-3 bg-rose-50 border border-rose-300 rounded-xl text-sm text-rose-800" : "hidden"}>{storageError}</div>
          {activeTab === 'dashboard' && (
            <HomeDashboard
              onSelectRoom={r => setDetailRoom(r)}
              onCheckInRoom={r => setCheckInRoom(r)}
              onCheckOutRoom={r => setCheckOutRoom(r)}
              onBookRoom={r => setBookingRoom(r)}
              onOpenQuickCheckIn={() => setIsQuickCheckInOpen(true)}
              onOpenQuickBooking={() => setIsQuickBookingOpen(true)}
              onOpenAddRoom={() => setEditingRoom(null)}
              onEditRoom={r => setEditingRoom(r)}
            />
          )}

          {activeTab === 'rooms' && (
            <RoomRackView
              onSelectRoom={r => setDetailRoom(r)}
              onCheckInRoom={r => setCheckInRoom(r)}
              onCheckOutRoom={r => setCheckOutRoom(r)}
              onBookRoom={r => setBookingRoom(r)}
              onOpenAddRoom={() => setEditingRoom(null)}
              onEditRoom={r => setEditingRoom(r)}
            />
          )}

          {activeTab === 'reservations' && (
            <ReservationList onOpenBookingModal={() => setIsQuickBookingOpen(true)} />
          )}

          {activeTab === 'stays' && (
            <ActiveStayManager
              onSelectRoom={r => setDetailRoom(r)}
              onCheckOutRoom={r => setCheckOutRoom(r)}
            />
          )}

          {activeTab === 'debt' && <DebtManagement />}
          {activeTab === 'sales' && <ServiceSalesView onPrint={setPrintedInvoice} />}

          {activeTab === 'analytics' && <AnalyticsDashboard />}

          {activeTab === 'reports' && <ExportReportView />}

          {activeTab === 'services' && (
            <ServiceCatalogView
              onOpenAddRoom={() => setEditingRoom(null)}
              onEditRoom={r => setEditingRoom(r)}
            />
          )}
          </Suspense>
        </main>
      </div>

      {/* Global Notifications and Confirmations */}
      <NotificationOverlay />

      {/* Modals */}
      {detailRoom && (
        <RoomDetailModal
          room={rooms.find(r => r.id === detailRoom.id) || detailRoom}
          onClose={() => setDetailRoom(null)}
          onCheckOut={r => {
            setDetailRoom(null);
            setCheckOutRoom(r);
          }}
          onEditRoom={r => {
            setDetailRoom(null);
            setEditingRoom(r);
          }}
        />
      )}

      {editingRoom !== undefined && (
        <RoomEditModal
          initialRoom={editingRoom}
          onClose={() => setEditingRoom(undefined)}
        />
      )}

      {(checkInRoom || isQuickCheckInOpen) && (
        <CheckInModal
          initialRoom={checkInRoom || undefined}
          onClose={() => {
            setCheckInRoom(null);
            setIsQuickCheckInOpen(false);
          }}
        />
      )}

      {(bookingRoom || isQuickBookingOpen) && (
        <BookingModal
          initialRoom={bookingRoom || undefined}
          onClose={() => {
            setBookingRoom(null);
            setIsQuickBookingOpen(false);
          }}
        />
      )}

      {checkOutRoom && (
        <CheckOutModal
          room={checkOutRoom}
          onClose={() => setCheckOutRoom(null)}
          onPrintInvoice={inv => setPrintedInvoice(inv)}
        />
      )}

      {printedInvoice && (
        <InvoicePrintView
          invoice={printedInvoice}
          onClose={() => setPrintedInvoice(null)}
        />
      )}
    </div>
  );
};

export default function App() {
  const Gate = cloudEnabled ? CloudAuthGate : AuthGate;
  return (
    <Gate>{(logout, passwordChanged) => <HotelProvider><MainLayout onLogout={logout} onPasswordChanged={passwordChanged} /></HotelProvider>}</Gate>
  );
}
