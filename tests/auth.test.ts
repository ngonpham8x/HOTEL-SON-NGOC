import { initialPassword, fixtureRecord, memoryStorage as authMemoryStorage } from './authFixture';
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyLoginPassword, changeLoginPassword, getLoginCredentialId, PasswordChangeError, CREDENTIAL_KEY, makeLoginSession, parseLoginSession, SESSION_DURATION } from '../src/utils/authSession';

function memoryStorage() {
  return authMemoryStorage();
}

test('local login accepts a saved verifier and rejects incorrect case or extra spaces', async () => {
  assert.equal(await verifyLoginPassword(initialPassword, memoryStorage()), true);
  assert.equal(await verifyLoginPassword(initialPassword.toLowerCase(), memoryStorage()), false);
  assert.equal(await verifyLoginPassword(initialPassword + " ", memoryStorage()), false);
  assert.equal(await verifyLoginPassword(''), false);
});
const configuredPassword = process.env.SON_NGOC_PRIMARY_TEST_PASSWORD;
test('initial configured verifier accepts its private input', { skip: !configuredPassword ? 'Private primary test input is not supplied' : false }, async () => {
  assert.equal(await verifyLoginPassword(configuredPassword!), true);
  assert.equal(await verifyLoginPassword(configuredPassword! + 'x'), false);
});
test('password verification also works without browser SubtleCrypto', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
    assert.equal(await verifyLoginPassword(initialPassword, memoryStorage()), true);
    assert.equal(await verifyLoginPassword('incorrect', memoryStorage()), false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else delete (globalThis as {crypto?: unknown}).crypto;
  }
});
test('login sessions reject corruption, future timestamps and expiration', () => {
  const now = Date.now();
  const session = makeLoginSession(now);
  assert.deepEqual(parseLoginSession(JSON.stringify(session), now), session);
  assert.equal(parseLoginSession(JSON.stringify(session), now + SESSION_DURATION), null);
  assert.equal(parseLoginSession(JSON.stringify(session), now - 1), null);
  assert.equal(parseLoginSession(JSON.stringify({...session, expiresAt: now + SESSION_DURATION * 2}), now), null);
  assert.equal(parseLoginSession('broken', now), null);
  assert.equal(parseLoginSession(null, now), null);
});

test('password changes persist a salted verifier, reject the old password and invalidate old sessions', async () => {
  const storage = memoryStorage();
  const now = Date.now();
  const previousId = getLoginCredentialId(storage);
  const session = makeLoginSession(now, previousId);
  await changeLoginPassword(initialPassword, 'NewPassword@2026', 'NewPassword@2026', storage);
  const record = storage.getItem(CREDENTIAL_KEY)!;
  assert.equal(record.includes('NewPassword'), false);
  assert.equal(record.includes('Trinh'), false);
  assert.equal(await verifyLoginPassword(initialPassword, storage), false);
  assert.equal(await verifyLoginPassword('NewPassword@2026', storage), true);
  const nextId = getLoginCredentialId(storage);
  assert.notEqual(nextId, previousId);
  assert.equal(parseLoginSession(JSON.stringify(session), now, nextId), null);
  const nextSession = makeLoginSession(now, nextId);
  assert.deepEqual(parseLoginSession(JSON.stringify(nextSession), now, nextId), nextSession);
  // Reading through a fresh storage wrapper models a reload, not an in-memory override.
  assert.equal(await verifyLoginPassword('NewPassword@2026', { ...storage }), true);
  await changeLoginPassword('NewPassword@2026', 'AnotherPass@2026', 'AnotherPass@2026', storage);
  assert.equal(await verifyLoginPassword('NewPassword@2026', storage), false);
  assert.equal(await verifyLoginPassword('AnotherPass@2026', storage), true);
});

test('invalid password changes never replace the saved credential', async () => {
  const storage = memoryStorage();
  for (const [current, next, confirmation, field] of [
    ['wrong-password', 'NewPassword@2026', 'NewPassword@2026', 'current'],
    [initialPassword, 'short', 'short', 'new'],
    [initialPassword, 'NewPassword@2026', 'DifferentPass@2026', 'confirmation'],
    [initialPassword, initialPassword, initialPassword, 'new'],
    [initialPassword, ' NewPassword@2026', ' NewPassword@2026', 'new'],
    [initialPassword, ' '.repeat(8), ' '.repeat(8), 'new'],
    [initialPassword, 'x'.repeat(129), 'x'.repeat(129), 'new'],
  ]) {
    await assert.rejects(changeLoginPassword(current, next, confirmation, storage), (error: unknown) => error instanceof PasswordChangeError && error.field === field);
    assert.equal(storage.getItem(CREDENTIAL_KEY), fixtureRecord);
  }
  assert.equal(await verifyLoginPassword(initialPassword, storage), true);
});

test('failed storage writes preserve the current password', async () => {
  const storage = memoryStorage();
  await changeLoginPassword(initialPassword, 'SavedPassword@2026', 'SavedPassword@2026', storage);
  const record = storage.getItem(CREDENTIAL_KEY);
  const blocked = { getItem: storage.getItem, setItem: () => { throw new Error('QuotaExceededError'); } };
  await assert.rejects(changeLoginPassword('SavedPassword@2026', 'RejectedPass@2026', 'RejectedPass@2026', blocked), /Không lưu được mật khẩu mới/);
  assert.equal(storage.getItem(CREDENTIAL_KEY), record);
  assert.equal(await verifyLoginPassword('SavedPassword@2026', storage), true);
  assert.equal(await verifyLoginPassword('RejectedPass@2026', storage), false);
});

test('corrupt or unreadable credentials cannot fall back to the initial password', async () => {
  const storage = memoryStorage();
  for (const value of ['broken', JSON.stringify({ version: 1, salt: '00', hash: 'ff', iterations: 210000, changedAt: Date.now() }), JSON.stringify({version: 2})]) {
    storage.setItem(CREDENTIAL_KEY, value);
    await assert.rejects(verifyLoginPassword(initialPassword, storage), /bị lỗi/);
    await assert.rejects(changeLoginPassword(initialPassword, 'NewPassword@2026', 'NewPassword@2026', storage), /bị lỗi/);
    assert.equal(storage.getItem(CREDENTIAL_KEY), value);
  }
  await assert.rejects(verifyLoginPassword(initialPassword, { getItem: () => { throw new Error('SecurityError'); }, setItem() {} }), /Không đọc được/);
});

test('legacy sessions remain valid only until the first password change', () => {
  const now = Date.now();
  const legacy = JSON.stringify({ version: 1, issuedAt: now, expiresAt: now + SESSION_DURATION });
  assert.ok(parseLoginSession(legacy, now));
  assert.equal(parseLoginSession(legacy, now, '1234567890abcdef1234567890abcdef'), null);
});

test('another window changing the credential during password verification cannot be overwritten', async () => {
  const storage = memoryStorage();
  const pending = changeLoginPassword(initialPassword, 'FirstPassword@2026', 'FirstPassword@2026', storage);
  // A valid revision written by another window while PBKDF2 is running.
  const other = JSON.stringify({ version: 1, salt: '1234567890abcdef1234567890abcdef', hash: 'a'.repeat(64), iterations: 210000, changedAt: Date.now() });
  storage.setItem(CREDENTIAL_KEY, other);
  await assert.rejects(pending, /cửa sổ khác/);
  assert.equal(storage.getItem(CREDENTIAL_KEY), other);
});
