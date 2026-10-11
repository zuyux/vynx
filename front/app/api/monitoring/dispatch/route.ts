import { limitPublicEndpoint } from '@/lib/public-rate-limit';
import { logServerRequest, serverLog } from '@/lib/server-log';
import { dispatchMonitoringAlerts, monitoringAuthorized } from '@/lib/error-monitoring';

export async function POST(request: Request) {
  return logServerRequest(request, '/api/monitoring/dispatch', async () => {
    const headers = { 'Cache-Control': 'no-store' };
    if (!monitoringAuthorized(request)) return Response.json({ error: 'Unauthorized.' }, { status: 401, headers });
    const limited = await limitPublicEndpoint(request, 'mutation');
    if (limited) return limited;
    try {
      const result = await dispatchMonitoringAlerts();
      if (result.failed) serverLog('monitoring_alert_failed', { failed: result.failed });
      return Response.json(result, { status: result.failed ? 502 : 200, headers });
    } catch {
      serverLog('monitoring_alert_failed', { failed: 1 });
      return Response.json({ error: 'Alert delivery unavailable.' }, { status: 503, headers });
    }
  });
}
