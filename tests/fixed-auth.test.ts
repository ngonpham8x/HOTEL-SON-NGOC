import { initialPassword, fixtureRecord, memoryStorage as authMemoryStorage } from './authFixture';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CREDENTIAL_KEY, changeLoginPassword, verifyLoginPassword, PasswordChangeError } from '../src/utils/authSession';
import { FIXED_LOGIN_CREDENTIAL } from '../src/data/fixedLoginCredential';

// Supply the real credential transiently; never store it in source or fixtures.
const secret = process.env.SON_NGOC_FIXED_TEST_PASSWORD;
const options = { skip: !secret ? 'Private credential test input is not supplied' : false };
function storageFixture() {
  return authMemoryStorage();
}

test('fixed login remains valid through primary password changes and can authorize a primary update', options, async () => {
  const storage = storageFixture();
  const before = JSON.stringify(FIXED_LOGIN_CREDENTIAL);
  assert.equal(await verifyLoginPassword(secret!, storage), true);
  assert.equal(await verifyLoginPassword(secret! + 'x', storage), false);
  await changeLoginPassword(initialPassword, 'NewPrimary@2026', 'NewPrimary@2026', storage);
  assert.equal(await verifyLoginPassword(initialPassword, storage), false);
  assert.equal(await verifyLoginPassword('NewPrimary@2026', storage), true);
  assert.equal(await verifyLoginPassword(secret!, storage), true);
  await changeLoginPassword(secret!, 'AnotherPrimary@2026', 'AnotherPrimary@2026', storage);
  assert.equal(await verifyLoginPassword('NewPrimary@2026', storage), false);
  assert.equal(await verifyLoginPassword('AnotherPrimary@2026', storage), true);
  assert.equal(await verifyLoginPassword(secret!, storage), true);
  assert.equal(JSON.stringify(FIXED_LOGIN_CREDENTIAL), before);
  assert.equal(storage.getItem(CREDENTIAL_KEY)!.includes(secret!), false);
});

test('the change-password form cannot overwrite or reuse the fixed credential as the primary password', options, async () => {
  const storage = storageFixture();
  const before = JSON.stringify(FIXED_LOGIN_CREDENTIAL);
  await assert.rejects(changeLoginPassword(initialPassword, secret!, secret!, storage), (error: unknown) => error instanceof PasswordChangeError && error.field === 'new' && !error.message.includes(secret!));
  assert.equal(storage.getItem(CREDENTIAL_KEY), fixtureRecord);
  assert.equal(await verifyLoginPassword(initialPassword, storage), true);
  assert.equal(await verifyLoginPassword(secret!, storage), true);
  await assert.rejects(changeLoginPassword(secret!, secret!, secret!, storage), (error: unknown) => error instanceof PasswordChangeError && error.field === 'new');
  assert.equal(JSON.stringify(FIXED_LOGIN_CREDENTIAL), before);
});

test('fixed login works with the PBKDF2 fallback when SubtleCrypto is absent', options, async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
    assert.equal(await verifyLoginPassword(secret!, storageFixture()), true);
    assert.equal(await verifyLoginPassword(secret! + ' ', storageFixture()), false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else delete (globalThis as {crypto?: unknown}).crypto;
  }
});
