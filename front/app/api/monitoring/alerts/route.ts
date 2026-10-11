import { logServerRequest } from '@/lib/server-log';
import { monitoringAuthorized } from '@/lib/error-monitoring';
import { appDb } from '@/lib/app-db';

export async function GET(request: Request) {
  return logServerRequest(request, '/api/monitoring/alerts', async () => {
    const headers = { 'Cache-Control': 'no-store' };
    if (!monitoringAuthorized(request)) return Response.json({ error: 'Unauthorized.' }, { status: 401, headers });
    try {
      const { data, error } = await appDb().from('error_alerts')
        .select('id,event,occurrences,first_seen,last_seen,delivered_at,attempts,next_attempt_at')
        .order('last_seen', { ascending: false }).limit(100).abortSignal(AbortSignal.timeout(2000));
      if (error) throw new Error('Unavailable');
      return Response.json({ alerts: data }, { headers });
    } catch { return Response.json({ error: 'Monitoring storage unavailable.' }, { status: 503, headers }); }
  });
}
