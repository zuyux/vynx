import nextEnv from "@next/env";
import { validateEnvironment } from "./env-validation.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const production = process.env.NODE_ENV === 'production' || ['prebuild', 'prestart'].includes(process.env.npm_lifecycle_event);
const errors = validateEnvironment({ ...process.env, ...(production ? { NODE_ENV: 'production' } : {}) });

if (errors.length > 0) {
  console.error("\nVYNX configuration is invalid:\n");
  for (const error of errors) console.error(`  - ${error}`);
  console.error("\nCopy .env.example to .env.local and replace every placeholder.\n");
  process.exit(1);
}

console.log("VYNX environment configuration is valid (Solana devnet only).");
