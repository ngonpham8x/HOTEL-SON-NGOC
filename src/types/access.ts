export const MODULE_IDS = ['dashboard', 'rooms', 'reservations', 'stays', 'sales', 'debt', 'analytics', 'reports', 'services'] as const;
export type ModuleId = typeof MODULE_IDS[number];
export const ACTION_IDS = ['booking.create', 'booking.cancel', 'booking.archive', 'stay.checkin', 'stay.checkout', 'stay.guests', 'stay.service.add', 'stay.service.remove', 'room.clean', 'room.status', 'room.configure', 'room.delete', 'service.configure', 'service.delete', 'sale.create', 'debt.collect', 'data.export', 'data.restore'] as const;
export type ActionId = typeof ACTION_IDS[number];
export interface StaffPermissions { views: ModuleId[]; actions: ActionId[] }
export interface AccessActor { id: string; role: 'ADMIN' | 'RECEPTION'; username: string; displayName: string; permissions: StaffPermissions; version: number }
export interface StaffAccount extends AccessActor { active: boolean; createdAt: string; updatedAt: string }
export interface StaffAccountInput { id?: string; expectedVersion?: number; username: string; displayName: string; password?: string; permissions: StaffPermissions; active: boolean }
export interface PasswordVerifier { salt: string; iterations: number; hash: string }
export interface StoredStaffAccount extends StaffAccount { credential: PasswordVerifier }
