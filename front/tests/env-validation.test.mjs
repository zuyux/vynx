import assert from "node:assert/strict";
import test from "node:test";
import { REQUIRED_ENV_KEYS, validateEnvironment } from "../scripts/env-validation.mjs";

const validEnvironment = {
  SUPABASE_URL: "https://abc.supabase.co",
  SUPABASE_ANON_KEY: "anon-key-value",
  SUPABASE_SECRET_KEY: "server-secret-value",
  NEXT_PUBLIC_TREASURY_WALLET: "11111111111111111111111111111111",
  NEXT_PUBLIC_SOLANA_RPC_URL: "https://api.devnet.solana.com",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_PHANTOM_APP_ID: "phantom-app-id",
};

test("accepts a complete devnet configuration", () => {
  assert.deepEqual(validateEnvironment(validEnvironment), []);
});
test('Kora is optional, validates its endpoint and keeps credentials server-only', () => {
  assert.deepEqual(validateEnvironment({ ...validEnvironment, KORA_RPC_URL: '', KORA_API_KEY: '' }), []);
  assert.deepEqual(validateEnvironment({ ...validEnvironment, KORA_RPC_URL: 'http://127.0.0.1:8080', KORA_API_KEY: 'private-key' }), []);
  assert.ok(validateEnvironment({ ...validEnvironment, KORA_RPC_URL: 'invalid' }).includes('KORA_RPC_URL must be a valid http(s) URL.'));
  assert.ok(validateEnvironment({ ...validEnvironment, NEXT_PUBLIC_KORA_API_KEY: 'secret' }).some(error => error.includes('public NEXT_PUBLIC_ prefix')));
});
test('allows extension-only login without a Phantom Portal App ID', () => {
  const { NEXT_PUBLIC_PHANTOM_APP_ID, ...extensionEnvironment } = validEnvironment;
  assert.deepEqual(validateEnvironment(extensionEnvironment), []);
  assert.deepEqual(validateEnvironment({...extensionEnvironment,NEXT_PUBLIC_PHANTOM_APP_ID:''}), []);
  assert.deepEqual(validateEnvironment({...extensionEnvironment,NEXT_PUBLIC_PHANTOM_APP_ID:'   '}), []);
  assert.ok(NEXT_PUBLIC_PHANTOM_APP_ID);
});

test("reports every missing required value", () => {
  const errors = validateEnvironment({});
  assert.equal(errors.length, REQUIRED_ENV_KEYS.length);
  for (const key of REQUIRED_ENV_KEYS) {
    assert.ok(errors.includes(`${key} is required.`));
  }
});

test("rejects known non-devnet RPC endpoints", () => {
  for (const network of ["mainnet-beta", "testnet"]) {
    const errors = validateEnvironment({
      ...validEnvironment,
      NEXT_PUBLIC_SOLANA_RPC_URL: `https://api.${network}.solana.com`,
    });
    assert.ok(errors.some((error) => error.includes("must target Solana devnet")));
  }
});

test("rejects placeholders, malformed values, and public secrets", () => {
  const errors = validateEnvironment({
    ...validEnvironment,
    SUPABASE_URL: "not-a-url",
    NEXT_PUBLIC_TREASURY_WALLET: "not a public key",
    NEXT_PUBLIC_APP_URL: "https://vynx.me/",
    NEXT_PUBLIC_PHANTOM_APP_ID: "your-phantom-app-id",
    NEXT_PUBLIC_PRIVATE_KEY: "leaked",
  });

  assert.ok(errors.some((error) => error.includes("SUPABASE_URL must be")));
  assert.ok(errors.some((error) => error.includes("TREASURY_WALLET must be")));
  assert.ok(errors.some((error) => error.includes("trailing slash")));
  assert.ok(errors.some((error) => error.includes("placeholder")));
  assert.ok(errors.some((error) => error.includes("public NEXT_PUBLIC_ prefix")));
});

 test("rejects public Supabase configuration", () => {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_KEY", "NEXT_PUBLIC_SUPABASE_SECRET_KEY"]) {
    const errors = validateEnvironment({ ...validEnvironment, [key]: "unsafe-value" });
    assert.ok(errors.some(error => error.includes(key) && error.includes("public NEXT_PUBLIC_ prefix")));
  }
});

test('registry configuration requires one private sponsor key source and a bounded integer budget', () => {
  assert.deepEqual(validateEnvironment({ ...validEnvironment, VYNX_ALIAS_REGISTRY_ENABLED: 'true', VYNX_ALIAS_SPONSOR_KEYPAIR_PATH: '/tmp/sponsor.json' }), []);
  for (const env of [
    { VYNX_ALIAS_REGISTRY_ENABLED: 'maybe' },
    { VYNX_ALIAS_REGISTRY_ENABLED: 'true' },
    { VYNX_ALIAS_REGISTRY_ENABLED: 'true', VYNX_ALIAS_SPONSOR_KEYPAIR_PATH: '/tmp/sponsor.json', VYNX_ALIAS_SPONSOR_SECRET_KEY: '[0]' },
    { VYNX_ALIAS_SPONSOR_DAILY_BUDGET_LAMPORTS: '-1' },
    { VYNX_ALIAS_SPONSOR_DAILY_BUDGET_LAMPORTS: '1.5' },
    { NEXT_PUBLIC_SPONSOR_KEYPAIR_PATH: '/tmp/sponsor.json' },
  ]) assert(validateEnvironment({ ...validEnvironment, ...env }).length > 0);
});
