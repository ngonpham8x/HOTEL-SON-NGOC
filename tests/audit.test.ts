import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalAuditEntry, filterLocalAudit } from '../src/utils/auditLogs';
import { ADMIN_ACTOR } from '../src/utils/permissions';
import { INITIAL_ROOMS, INITIAL_SERVICES } from '../src/data/initialData';
import type { HotelData } from '../src/utils/hotelStorage';
import type { AuditEntry } from '../src/types/audit';

const data: HotelData = { rooms: structuredClone(INITIAL_ROOMS), services: structuredClone(INITIAL_SERVICES), reservations: [], stays: [], invoices: [], debts: [] };
test('local business audit captures actor and field changes without copying customer identity or secrets', () => {
  const next = structuredClone(data); next.rooms[0].cleanStatus = 'DIRTY'; next.rooms[0].notes = 'Private customer note';
  const entry = createLocalAuditEntry(ADMIN_ACTOR,data,next,'room.clean')!;
  assert.equal(entry.actorId,'admin'); assert.equal(entry.details[0].before.cleanStatus,'CLEAN'); assert.equal(entry.details[0].after.cleanStatus,'DIRTY');
  assert.equal(JSON.stringify(entry).includes('Private customer note'),false);
  assert.equal(createLocalAuditEntry(ADMIN_ACTOR,data,data,'room.clean'),undefined,'no change creates no duplicate evidence');
});

test('actor/action/date filters use Vietnam day boundaries, retain deleted actors, and paginate without duplicates', () => {
  const template = createLocalAuditEntry(ADMIN_ACTOR,data,{ ...data, rooms: data.rooms.slice(1) },'room.delete')!;
  const entries: AuditEntry[] = Array.from({ length: 65 },(_,index) => ({ ...template,id:String(index),actorId: index % 2 ? 'staff-deleted' : 'admin', actorName: index % 2 ? 'Lễ tân đã xóa' : 'Quản lý',action:index % 2 ? 'sale.cancel' : 'room.clean',createdAt:'2026-10-11T18:00:00Z' }));
  const first = filterLocalAudit(entries,{ fromDate:'2026-10-12',toDate:'2026-10-12' });
  assert.equal(first.entries.length,50); assert.ok(first.nextCursor);
  const second = filterLocalAudit(entries,{ fromDate:'2026-10-12',toDate:'2026-10-12',beforeId:first.nextCursor! });
  assert.equal(second.entries.length,15); assert.equal(new Set([...first.entries,...second.entries].map(entry => entry.id)).size,65);
  const staff = filterLocalAudit(entries,{ actorId:'staff-deleted',operation:'sale.cancel' });
  assert.equal(staff.entries.length,32); assert.ok(staff.actors.some(actor => actor.id==='staff-deleted'));
  assert.equal(filterLocalAudit(entries,{ fromDate:'2026-10-11',toDate:'2026-10-11' }).entries.length,0);
  assert.throws(() => filterLocalAudit(entries,{ fromDate:'2026-02-30' }));
  assert.throws(() => filterLocalAudit(entries,{ beforeId:'missing' }));
});
