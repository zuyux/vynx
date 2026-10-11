import { limitPublicEndpoint } from '@/lib/public-rate-limit';
import { logServerRequest } from '@/lib/server-log';
import { monitoringAuthorized, monitoringEvent, recordMonitoringEvent } from '@/lib/error-monitoring';

export async function POST(request: Request) {
  return logServerRequest(request, '/api/monitoring/webhook', async () => {
    const headers = { 'Cache-Control': 'no-store' };
    if (!monitoringAuthorized(request)) return Response.json({ error: 'Unauthorized.' }, { status: 401, headers });
    const limited = await limitPublicEndpoint(request, 'mutation');
    if (limited) return limited;
    // Read at most 4 KiB; never buffer an arbitrary webhook body.
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: 'Invalid event.' }, { status: 400, headers });
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 4096) {
          await reader.cancel();
          return Response.json({ error: 'Event too large.' }, { status: 413, headers });
        }
        chunks.push(value);
      }
      const event = monitoringEvent(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      if (!event) return Response.json({ error: 'Invalid event.' }, { status: 400, headers });
      try { await recordMonitoringEvent(event); }
      catch { return Response.json({ error: 'Monitoring storage unavailable.' }, { status: 503, headers }); }
      return Response.json({ accepted: true }, { status: 202, headers });
    } catch { return Response.json({ error: 'Invalid event.' }, { status: 400, headers }); }
    finally { reader.releaseLock(); }
  });
}
