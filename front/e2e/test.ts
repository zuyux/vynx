import { test as base, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

export const test = base.extend<{ resetRequestLimits: void }>({
  resetRequestLimits: [async ({}, use) => {
    // Each scenario shares a loopback client IP. Reset only the isolated test DB,
    // preserving real limits within each scenario and production enforcement.
    const url = new URL(process.env.SUPABASE_URL!);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('E2E requires an isolated local database.');
    const db = createClient(url.href, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
    const { error } = await db.from('public_endpoint_limits').delete().neq('client_hash', '');
    if (error) throw error;
    await use();
  }, { auto: true }],
});
export { expect };
