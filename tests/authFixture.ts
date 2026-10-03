import { pbkdf2Sync } from 'node:crypto';
import { CREDENTIAL_KEY } from '../src/utils/authSession';
export const initialPassword = 'QA Auth Fixture@2026';
export const fixtureCredential = { salt: 'abcabcabcabcabcabcabcabcabcabcab', iterations: 210000, hash: pbkdf2Sync(initialPassword, Buffer.from('abcabcabcabcabcabcabcabcabcabcab', 'hex'), 210000, 32, 'sha256').toString('hex') };
export const fixtureRecord = JSON.stringify({ version: 1, ...fixtureCredential, changedAt: Date.now() });
export function memoryStorage() {
  const values = new Map<string, string>([[CREDENTIAL_KEY, fixtureRecord]]);
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
