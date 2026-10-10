export const REQUIRED_ENV_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SECRET_KEY",
  "NEXT_PUBLIC_TREASURY_WALLET",
  "NEXT_PUBLIC_SOLANA_RPC_URL",
  "NEXT_PUBLIC_APP_URL",
];

const PLACEHOLDER_PATTERN = /(^|[-_])(your|replace|example)([-_]|$)|<[^>]+>/i;

function isUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateEnvironment(env) {
  const errors = [];

  for (const key of REQUIRED_ENV_KEYS) {
    const value = env[key]?.trim();
    if (!value) {
      errors.push(`${key} is required.`);
    } else if (PLACEHOLDER_PATTERN.test(value)) {
      errors.push(`${key} still contains an example placeholder.`);
    }
  }
  const phantomAppId = env.NEXT_PUBLIC_PHANTOM_APP_ID?.trim();
  if (phantomAppId && PLACEHOLDER_PATTERN.test(phantomAppId)) {
    errors.push('NEXT_PUBLIC_PHANTOM_APP_ID still contains an example placeholder. Leave it empty to use the Phantom extension.');
  }

  for (const key of [
    "SUPABASE_URL",
    "NEXT_PUBLIC_SOLANA_RPC_URL",
    "NEXT_PUBLIC_APP_URL",
    "KORA_RPC_URL",
  ]) {
    const value = env[key]?.trim();
    if (value && !PLACEHOLDER_PATTERN.test(value) && !isUrl(value)) {
      errors.push(`${key} must be a valid http(s) URL.`);
    }
  }

  const rpcUrl = env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim().toLowerCase();
  if (rpcUrl && /mainnet|testnet/.test(rpcUrl)) {
    errors.push(
      "NEXT_PUBLIC_SOLANA_RPC_URL must target Solana devnet; mainnet and testnet are unsupported."
    );
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl?.endsWith("/")) {
    errors.push("NEXT_PUBLIC_APP_URL must not have a trailing slash.");
  }

  const treasury = env.NEXT_PUBLIC_TREASURY_WALLET?.trim();
  if (
    treasury &&
    !PLACEHOLDER_PATTERN.test(treasury) &&
    !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(treasury)
  ) {
    errors.push("NEXT_PUBLIC_TREASURY_WALLET must be a valid base58 public key.");
  }

  const leakedSecret = Object.keys(env).find(
    (key) => key.startsWith("NEXT_PUBLIC_") && /SUPABASE|SECRET|SERVICE_ROLE|PRIVATE_KEY|KEYPAIR|KORA_API_KEY|KORA_HMAC/.test(key)
  );
  if (leakedSecret) {
    errors.push(`${leakedSecret} looks like a secret but uses the public NEXT_PUBLIC_ prefix.`);
  }

  if (env.VYNX_ALIAS_REGISTRY_ENABLED && !['true', 'false'].includes(env.VYNX_ALIAS_REGISTRY_ENABLED)) errors.push('VYNX_ALIAS_REGISTRY_ENABLED must be true or false.');
  if (env.VYNX_ALIAS_REGISTRY_ENABLED === 'true' && !!env.VYNX_ALIAS_SPONSOR_SECRET_KEY === !!env.VYNX_ALIAS_SPONSOR_KEYPAIR_PATH) errors.push('Configure exactly one server-only sponsor key source.');
  const budget = env.VYNX_ALIAS_SPONSOR_DAILY_BUDGET_LAMPORTS;
  if (budget && (!/^[0-9]+$/.test(budget) || !Number.isSafeInteger(Number(budget)) || Number(budget) < 1)) errors.push('VYNX_ALIAS_SPONSOR_DAILY_BUDGET_LAMPORTS must be a positive safe integer.');
  return errors;
}
