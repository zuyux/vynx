import type { SupabaseClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';
import { aliasAvailabilityClientHash } from './alias-availability';
import { appDb } from './app-db';

type Policy = 'auth' | 'payment' | 'mutation' | 'sponsorship';

// A shared database counter protects all instances. Payment routes deliberately
// share a bucket, including Action routes and transaction confirmations.
export async function limitPublicEndpoint(
  request: Request, policy: Policy, extraHeaders: HeadersInit = {},
  dependencies?: { db: SupabaseClient; secret: string; trustedVercel?: boolean },
): Promise<Response | null> {
  const headers = new Headers(extraHeaders);
  headers.set('Cache-Control', 'no-store');
  try {
    const secret = dependencies?.secret ?? process.env.SUPABASE_SECRET_KEY;
    if (!secret) throw new Error('Missing limiter secret');
    const client = aliasAvailabilityClientHash(request, secret, dependencies?.trustedVercel);
    const clientHash = createHmac('sha256', secret).update(`public-endpoint:${policy}:${client}`).digest('hex');
    const { data, error } = await (dependencies?.db ?? appDb()).rpc('consume_public_endpoint_limit', {
      client_hash: clientHash, policy,
    });
    if (error || typeof data?.allowed !== 'boolean' || !Number.isInteger(data.retry_after) || data.retry_after < 1 || data.retry_after > 60) {
      throw new Error('Unavailable limiter');
    }
    if (data.allowed) return null;
    headers.set('Retry-After', String(data.retry_after));
    return Response.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429, headers });
  } catch {
    return Response.json({ error: 'This service is temporarily unavailable. Please try again.' }, { status: 503, headers });
  }
}
