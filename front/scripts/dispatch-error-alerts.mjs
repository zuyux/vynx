import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());

try {
  const origin = new URL(process.env.NEXT_PUBLIC_APP_URL).origin;
  const token = process.env.ERROR_MONITORING_TOKEN;
  if (!token || token.length < 32) throw new Error('Missing token');
  const response = await fetch(`${origin}/api/monitoring/dispatch`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Delivery unavailable');
  const result = await response.json();
  // Never echo the remote response directly.
  console.info(JSON.stringify({ event: 'alert_dispatch_completed', sent: Number(result.sent) || 0, failed: Number(result.failed) || 0 }));
} catch {
  console.error('Alert dispatch failed. Check the monitoring inbox and server configuration.');
  process.exitCode = 1;
}
