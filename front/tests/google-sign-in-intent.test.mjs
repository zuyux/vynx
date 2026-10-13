import test from 'node:test';
import assert from 'node:assert/strict';
import { beginGoogleSignIn, clearGoogleSignIn, googleSignInPending } from '../lib/google-sign-in-intent.ts';

test('Google navigation intent survives a reload, expires, and clears after cancellation', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const now = Date.now;
  const values = new Map();
  let clock = 1_000_000;
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  } });
  Date.now = () => clock;
  try {
    assert.equal(googleSignInPending(), false);
    beginGoogleSignIn();
    // A fresh caller reads the persisted value without an in-memory promise.
    assert.equal(googleSignInPending(), true);
    clock += 10 * 60_000;
    assert.equal(googleSignInPending(), false);
    beginGoogleSignIn();
    clearGoogleSignIn();
    assert.equal(googleSignInPending(), false);
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() { throw new Error('Storage blocked'); } });
    assert.doesNotThrow(beginGoogleSignIn);
    assert.doesNotThrow(clearGoogleSignIn);
    assert.equal(googleSignInPending(), false);
  } finally {
    Date.now = now;
    if (original) Object.defineProperty(globalThis, 'sessionStorage', original);
    else delete globalThis.sessionStorage;
  }
});
