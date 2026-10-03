import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_ACTOR, DEFAULT_STAFF_PERMISSIONS } from '../src/utils/permissions';
import { CREDENTIAL_KEY } from '../src/utils/authSession';
import { listSystemStaff, saveSystemStaff } from '../src/utils/systemAuth';
import { changeStaffPassword, freshStaffActor, listStaffAccounts, makeStaffSession, parseStaffSession, saveStaffAccount, STAFF_ACCOUNTS_KEY, verifyStaffLogin } from '../src/utils/staffAccounts';
import { memoryStorage } from './authFixture';

const password = 'Reception QA@2026';
function input(username = 'reception.one') { return { username, displayName: 'Lễ tân kiểm thử', password, active: true, permissions: { views: [...DEFAULT_STAFF_PERMISSIONS.views], actions: [...DEFAULT_STAFF_PERMISSIONS.actions] } }; }

test('staff has distinct salted credentials, no implicit account, and account list never reveals the verifier', async () => {
  const storage = memoryStorage();
  assert.equal(await verifyStaffLogin('reception.one', password, storage), null);
  const account = await saveStaffAccount(input(), storage);
  assert.equal(account.role, 'RECEPTION');
  assert.equal('credential' in account, false);
  assert.equal('credential' in listStaffAccounts(storage)[0], false);
  const stored = JSON.parse(storage.getItem(STAFF_ACCOUNTS_KEY)!);
  assert.equal(stored.accounts[0].credential.iterations, 210000);
  assert.equal(storage.getItem(STAFF_ACCOUNTS_KEY)!.includes(password), false);
  assert.equal(await verifyStaffLogin('reception.one', 'wrong', storage), null);
  const actor = await verifyStaffLogin(' RECEPTION.ONE ', password, storage);
  assert.equal(actor?.id, account.id);
  assert.equal(actor?.role, 'RECEPTION');
  assert.equal(actor?.permissions.actions.includes('data.restore'), false);
});

test('staff cannot grant manager role or restore access, use reserved username, or administer other accounts', async () => {
  const storage = memoryStorage();
  await assert.rejects(saveStaffAccount({ ...input(), username: 'admin' }, storage), /Tên đăng nhập/);
  await assert.rejects(saveStaffAccount({ ...input(), permissions: { views: ['reports'], actions: ['data.restore'] } }, storage), /Quyền truy cập/);
  const account = await saveStaffAccount({ ...input(), role: 'ADMIN' } as ReturnType<typeof input>, storage);
  assert.equal(account.role, 'RECEPTION');
  await assert.rejects(listSystemStaff(account), /Chỉ quản lý/);
  await assert.rejects(saveSystemStaff(account, input('another.reception')), /Chỉ quản lý/);
  // Tampered role persisted by local developer tools fails closed on reading.
  const tampered = JSON.parse(storage.getItem(STAFF_ACCOUNTS_KEY)!);
  tampered.accounts[0].role = 'ADMIN';
  storage.setItem(STAFF_ACCOUNTS_KEY, JSON.stringify(tampered));
  assert.throws(() => listStaffAccounts(storage), /Thông tin tài khoản lễ tân bị lỗi/);
});

test('staff sessions re-read live permissions; permission changes and disabling revoke old sessions', async () => {
  const storage = memoryStorage();
  const account = await saveStaffAccount(input(), storage);
  const actor = (await verifyStaffLogin(account.username, password, storage))!;
  const session = JSON.stringify(makeStaffSession(actor));
  assert.equal(parseStaffSession(session, Date.now(), storage)?.actor.id, actor.id);
  const updated = await saveStaffAccount({ ...account, expectedVersion: account.version, permissions: { views: ['rooms'], actions: ['room.clean'] } }, storage);
  assert.equal(updated.version, actor.version + 1);
  assert.equal(parseStaffSession(session, Date.now(), storage), null);
  assert.throws(() => freshStaffActor(actor, storage), /quyền truy cập đã thay đổi/);
  const newActor = (await verifyStaffLogin(account.username, password, storage))!;
  assert.deepEqual(newActor.permissions, { views: ['rooms'], actions: ['room.clean'] });
  const newSession = JSON.stringify(makeStaffSession(newActor));
  await saveStaffAccount({ ...updated, expectedVersion: updated.version, active: false }, storage);
  assert.equal(parseStaffSession(newSession, Date.now(), storage), null);
  assert.equal(await verifyStaffLogin(account.username, password, storage), null);
  assert.equal(parseStaffSession(session, Date.now() + 13 * 60 * 60 * 1000, storage), null);
});

test('own password rotation affects only that receptionist and preserves manager and other staff credentials', async () => {
  const storage = memoryStorage(), managerCredential = storage.getItem(CREDENTIAL_KEY);
  const first = await saveStaffAccount(input(), storage), second = await saveStaffAccount(input('reception.two'), storage);
  const actor = (await verifyStaffLogin(first.username, password, storage))!;
  await assert.rejects(changeStaffPassword(actor, 'wrong current', 'Next Reception@2026', 'Next Reception@2026', storage), /hiện tại chưa đúng/);
  const oldSession = JSON.stringify(makeStaffSession(actor));
  await changeStaffPassword(actor, password, 'Next Reception@2026', 'Next Reception@2026', storage);
  assert.equal(storage.getItem(CREDENTIAL_KEY), managerCredential);
  assert.equal(await verifyStaffLogin(first.username, password, storage), null);
  assert.equal((await verifyStaffLogin(first.username, 'Next Reception@2026', storage))?.role, 'RECEPTION');
  assert.equal((await verifyStaffLogin(second.username, password, storage))?.id, second.id);
  assert.equal(parseStaffSession(oldSession, Date.now(), storage), null);
  await assert.rejects(changeStaffPassword(ADMIN_ACTOR, password, 'Another Password@2026', 'Another Password@2026', storage), /Tài khoản lễ tân không hợp lệ/);
});

test('concurrent account edits fail rather than overwrite another editor, duplicate names and malformed stores are rejected', async () => {
  const storage = memoryStorage();
  const results = await Promise.allSettled([saveStaffAccount(input('first.reception'), storage), saveStaffAccount(input('second.reception'), storage)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  assert.equal(listStaffAccounts(storage).length, 1);
  const existing = listStaffAccounts(storage)[0];
  await assert.rejects(saveStaffAccount(input(existing.username), storage), /đã được sử dụng/);
  storage.setItem(STAFF_ACCOUNTS_KEY, '{broken');
  await assert.rejects(verifyStaffLogin(existing.username, password, storage), /Thông tin tài khoản lễ tân bị lỗi/);
  assert.equal(parseStaffSession(JSON.stringify(makeStaffSession(existing)), Date.now(), storage), null);
});

test('an old opened editor cannot overwrite newer account permissions or password', async () => {
  const storage = memoryStorage();
  const account = await saveStaffAccount(input(), storage);
  const newer = await saveStaffAccount({ ...account, expectedVersion: account.version, displayName: 'Quyền vừa cập nhật', permissions: { views: ['rooms'], actions: ['room.clean'] } }, storage);
  const snapshot = storage.getItem(STAFF_ACCOUNTS_KEY);
  await assert.rejects(saveStaffAccount({ ...account, expectedVersion: account.version, displayName: 'Nội dung cũ', password: 'Stale Password@2026' }, storage), /vừa được cập nhật/);
  await assert.rejects(saveStaffAccount({ ...newer, displayName: 'Thiếu phiên bản' }, storage), /vừa được cập nhật/);
  assert.equal(storage.getItem(STAFF_ACCOUNTS_KEY), snapshot);
  assert.equal((await verifyStaffLogin(account.username, password, storage))?.displayName, 'Quyền vừa cập nhật');
});
