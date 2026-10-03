import { initialPassword, fixtureCredential } from './authFixture';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_LOGIN_CREDENTIAL } from '../src/data/fixedLoginCredential';
import { INITIAL_ROOMS, INITIAL_SERVICES, INITIAL_RESERVATIONS } from '../src/data/initialData';
import type { HotelData } from '../src/utils/hotelStorage';

test('cloud API authenticates server sessions, rejects stale writes and invalidates sessions after a primary password change', async () => {
  let handler: (request: Request) => Promise<Response>;
  const auth = { version: 1, primary_credential: { ...fixtureCredential }, fixed_credential: { ...FIXED_LOGIN_CREDENTIAL } };
  let state: { revision: number; data: HotelData } = { revision: 0, data: { rooms: INITIAL_ROOMS, services: INITIAL_SERVICES, reservations: [], stays: [], invoices: [], debts: [] } };
  const sessions = new Map<string, { auth_version: number; expires_at: string }>();
  const receipts = new Set<string>();
  let dropNextWriteResponse = false;
  Object.assign(globalThis, { Deno: { env: { get: (name: string) => name === 'SUPABASE_URL' ? 'https://qa.supabase.co' : 'server-test-key' }, serve: (callback: typeof handler) => { handler = callback; } } });
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const u = new URL(String(url)), path = u.pathname.replace('/rest/v1/', '');
    const body = options?.body ? JSON.parse(String(options.body)) : null;
    const reply = (data: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status }));
    assert.equal((options?.headers as Record<string, string>).apikey, 'server-test-key');
    if (path === 'hotel_auth') return reply([auth]);
    if (path === 'hotel_state') return reply([state]);
    if (path === 'hotel_mutations') return reply(receipts.has(u.searchParams.get('request_id')!.replace('eq.', '')) ? [{ request_id: u.searchParams.get('request_id')!.replace('eq.', '') }] : []);
    if (path === 'hotel_sessions') {
      const hash = u.searchParams.get('token_hash')!.replace('eq.', '');
      if (options?.method === 'DELETE') { sessions.delete(hash); return reply([]); }
      const session = sessions.get(hash); return reply(session?.auth_version === auth.version ? [session] : []);
    }
    if (path === 'rpc/hotel_rate_limit') return reply(true);
    if (path === 'rpc/hotel_open_session') { sessions.set(body.p_hash, { auth_version: auth.version, expires_at: new Date(Date.now()+43200000).toISOString() }); return reply(body.p_version === auth.version); }
    if (path === 'rpc/hotel_save_authorized') {
      if (receipts.has(body.p_request_id)) return reply(state);
      if (body.p_revision !== state.revision) return reply({ message: 'STALE_REVISION' }, 400);
      state = { revision: state.revision + 1, data: body.p_data }; receipts.add(body.p_request_id);
      if (dropNextWriteResponse) { dropNextWriteResponse = false; throw new Error('Simulated lost database response'); }
      return reply(state);
    }
    if (path === 'rpc/hotel_change_password') { auth.primary_credential = body.p_credential; auth.version++; sessions.clear(); return reply(true); }
    throw new Error(`Unexpected test database request: ${path}`);
  };
  try {
    await import('../supabase/functions/hotel-api/index.ts');
    const request = (action: string, payload: Record<string, unknown> = {}, token?: string) => handler(new Request('https://qa/functions/v1/hotel-api', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action, ...(action === 'write' ? { operation: 'room.clean' } : {}), ...payload }) }));
    assert.equal((await request('read')).status, 401);
    assert.equal((await request('read', {}, 'f'.repeat(64))).status, 401);
    assert.equal((await request('login', { password: 'incorrect' })).status, 400);
    const response = await request('login', { password: initialPassword }); assert.equal(response.status, 200);
    const login = await response.json(); assert.deepEqual(Object.keys(login), ['token', 'actor']); assert.equal(login.actor.role, 'ADMIN'); assert.match(login.token, /^[a-f0-9]{64}$/);
    assert.equal((await request('read', {}, login.token)).status, 200);
    const requestId = 'a'.repeat(32);
    assert.equal((await request('write', { data: state.data, revision: 0, requestId }, login.token)).status, 200);
    assert.equal(state.revision, 1);
    assert.equal((await request('write', { data: state.data, revision: 0, requestId }, login.token)).status, 200);
    assert.equal(state.revision, 1, 'retry must not create another transaction');
    assert.equal((await request('write', { data: state.data, revision: 0, requestId: 'b'.repeat(32) }, login.token)).status, 409);
    const booking = { ...INITIAL_RESERVATIONS[0], status: 'CONFIRMED', roomId: 'room-test', checkInDate: '2027-10-11', checkOutDate: '2027-10-12' };
    assert.equal((await request('write', { operation: 'data.restore', data: { ...state.data, reservations: [{ ...booking, id: 'a' }, { ...booking, id: 'b' }] }, revision: 1, requestId: 'c'.repeat(32) }, login.token)).status, 409);
    assert.equal(state.revision, 1);
    assert.equal((await request('password', { current: 'incorrect', next: 'QA Only 2026', confirmation: 'QA Only 2026' }, login.token)).status, 400);
    dropNextWriteResponse = true;
    const lostResponseId = 'd'.repeat(32);
    const uncertain = await request('write', { data: state.data, revision: 1, requestId: lostResponseId }, login.token);
    assert.equal(uncertain.status, 503);
    assert.match((await uncertain.json()).error, /Chưa xác nhận/);
    assert.equal((await request('write', { data: state.data, revision: 1, requestId: lostResponseId }, login.token)).status, 200);
    assert.equal(state.revision, 2, 'retry after a lost response confirms the original transaction');
    const fixedBefore = { ...auth.fixed_credential };
    assert.equal((await request('password', { current: initialPassword, next: 'QA Only 2026', confirmation: 'QA Only 2026' }, login.token)).status, 200);
    assert.deepEqual(auth.fixed_credential, fixedBefore); assert.equal((await request('read', {}, login.token)).status, 401);
    assert.equal((await request('login', { password: initialPassword })).status, 400);
    assert.equal((await request('login', { password: 'QA Only 2026' })).status, 200);
  } finally { globalThis.fetch = original; Reflect.deleteProperty(globalThis, 'Deno'); }
});
