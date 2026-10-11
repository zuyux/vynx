import { createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError } from './wallet-session';

export type VideoEvent = { event_id: string; event_type: string; event_ts: number; payload: Record<string, unknown> };
export type VideoRoom = { booking_id: string; room_name: string; creator_user_id: string; fan_user_id: string };
export const DAILY_EVENTS = ['participant.joined', 'participant.left', 'meeting.started', 'meeting.ended'] as const;
export const callWindow = (start: string, end: string) => ({ nbf: Math.floor(Date.parse(start) / 1000) - 600, exp: Math.floor(Date.parse(end) / 1000) + 600 });

export async function dailyRequest(path: string, body?: unknown) {
  const key = process.env.DAILY_API_KEY;
  if (!key) throw new ApiError("Video calls are not configured yet.", 503, 'VIDEO_UNAVAILABLE');
  const response = await fetch(`https://api.daily.co/v1/${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), cache: 'no-store', signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new ApiError('Could not contact the video provider.', 503, 'VIDEO_UNAVAILABLE');
  return await response.json();
}
export function roomProperties(start: string, end: string) {
  return { ...callWindow(start, end), max_participants: 2, enable_knocking: false, enforce_unique_user_ids: true,
    eject_at_room_exp: true, enable_recording: null,
    permissions: { hasPresence: true, canSend: true, canReceive: { base: true }, canAdmin: false } };
}
export function assertPrivateRoom(room: Record<string, unknown>, name: string, start: string, end: string): string {
  const config = room.config as Record<string, unknown> | undefined;
  const window = callWindow(start, end);
  let url: URL;
  try { url = new URL(String(room.url)); } catch { throw new ApiError("Invalid video room.", 503); }
  if (room.name !== name || room.privacy !== 'private' || !config || config.max_participants !== 2
    || config.enforce_unique_user_ids !== true || config.enable_knocking !== false || config.eject_at_room_exp !== true
    || config.nbf !== window.nbf || config.exp !== window.exp || (config.enable_recording != null && config.enable_recording !== false)
    || url.protocol !== 'https:' || !url.hostname.endsWith('.daily.co') || url.pathname.replace(/\/$/, '') !== `/${name}` || url.search || url.hash) {
    throw new ApiError("The room does not meet the booking restrictions.", 503);
  }
  return url.toString();
}
export function tokenProperties(room: VideoRoom, role: 'creator' | 'fan', start: string, end: string) {
  return { room_name: room.room_name, ...callWindow(start, end), user_id: role === 'creator' ? room.creator_user_id : room.fan_user_id,
    user_name: role === 'creator' ? 'Creator' : 'Fan', is_owner: false, eject_at_token_exp: true,
    enable_recording_ui: false, start_cloud_recording: false,
    permissions: { hasPresence: true, canSend: true, canReceive: { base: true }, canAdmin: false } };
}
export async function boundedJSON(request: Request, max = 16_384): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("Missing data.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > max) { await reader.cancel(); throw new ApiError('Request too large.', 413); }
      chunks.push(value);
    }
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new ApiError("Invalid request.");
    return result;
  } finally { reader.releaseLock(); }
}
export function verifyDailyWebhook(headers: Headers, body: Record<string, unknown>, now = Date.now()) {
  const secret = process.env.DAILY_WEBHOOK_HMAC_BASE64;
  if (!secret || !/^[A-Za-z0-9+/]+={0,2}$/.test(secret) || Buffer.from(secret, 'base64').length < 32) throw new ApiError('Webhook is not configured.', 503);
  const timestamp = headers.get('x-webhook-timestamp') ?? '';
  const signature = headers.get('x-webhook-signature') ?? '';
  // Daily signs the timestamp header and the JSON-serialized event, with a base64 secret.
  if (!/^\d+(\.\d+)?$/.test(timestamp) || Math.abs(now / 1000 - (Number(timestamp) > 1e12 ? Number(timestamp) / 1000 : Number(timestamp))) > 300) throw new ApiError('Webhook expired.', 401);
  const expected = createHmac('sha256', Buffer.from(secret, 'base64')).update(`${timestamp}.${JSON.stringify(body)}`).digest('base64');
  const received = Buffer.from(signature), calculated = Buffer.from(expected);
  if (received.length !== calculated.length || !timingSafeEqual(received, calculated)) throw new ApiError("Invalid webhook signature.", 401);
}
export function normalizedEvent(body: Record<string, unknown>): VideoEvent | null {
  if (!DAILY_EVENTS.includes(body.type as typeof DAILY_EVENTS[number])) return null;
  if (body.version !== '1.0.0' || typeof body.id !== 'string' || body.id.length > 256 || !body.id || typeof body.event_ts !== 'number' || !Number.isFinite(body.event_ts)
    || !body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) throw new ApiError("Invalid event.");
  const input = body.payload as Record<string, unknown>;
  // Explicit allowlist: provider payloads may contain identities or recording access tokens.
  const payload: Record<string, unknown> = {};
  for (const field of ['room', 'user_id', 'session_id', 'joined_at', 'duration', 'meeting_id', 'start_ts', 'end_ts']) {
    if (typeof input[field] === 'string' && (input[field] as string).length <= 256 || typeof input[field] === 'number' && Number.isFinite(input[field])) payload[field] = input[field];
  }
  if (typeof payload.room !== 'string') throw new ApiError("Event has no room.");
  return { event_id: body.id, event_type: body.type as string, event_ts: body.event_ts, payload };
}

type Interval = [number, number];
function union(intervals: Interval[]) {
  const result: Interval[] = [];
  for (const interval of intervals.sort((a, b) => a[0] - b[0])) {
    const previous = result.at(-1);
    if (previous && interval[0] <= previous[1]) previous[1] = Math.max(previous[1], interval[1]); else result.push([...interval]);
  }
  return result;
}
export function attendance(events: VideoEvent[], room: VideoRoom, start: string, end: string) {
  const from = Date.parse(start) / 1000, until = Date.parse(end) / 1000;
  const sessions = new Map<string, { user: string; joined?: number; leftJoined?: number; end?: number }>();
  const gaps = new Set<string>(); const meetings = new Map<string, { start?: number; end?: number }>();
  for (const event of events) {
    const p = event.payload;
    if (event.event_type.startsWith('meeting.')) {
      if (typeof p.meeting_id !== 'string' || typeof p.start_ts !== 'number') { gaps.add('invalid_meeting'); continue; }
      const meeting = meetings.get(p.meeting_id) ?? {}; meeting.start = p.start_ts;
      if (event.event_type === 'meeting.ended') { if (typeof p.end_ts === 'number' && p.end_ts >= p.start_ts) meeting.end = p.end_ts; else gaps.add('invalid_meeting'); }
      meetings.set(p.meeting_id, meeting); continue;
    }
    if (p.user_id !== room.creator_user_id && p.user_id !== room.fan_user_id) { gaps.add('unknown_participant'); continue; }
    if (typeof p.session_id !== 'string' || typeof p.joined_at !== 'number') { gaps.add('invalid_session'); continue; }
    const session = sessions.get(p.session_id) ?? { user: p.user_id as string };
    if (session.user !== p.user_id) { gaps.add('conflicting_session'); continue; }
    if (event.event_type === 'participant.joined') {
      if (session.joined !== undefined && session.joined !== p.joined_at) gaps.add('conflicting_session');
      session.joined = p.joined_at;
    } else if (typeof p.duration === 'number' && p.duration >= 0 && p.duration <= 86_400) {
      const finish = p.joined_at + p.duration;
      if (session.end !== undefined && (session.end !== finish || session.leftJoined !== p.joined_at)) gaps.add('conflicting_session');
      session.leftJoined = p.joined_at; session.end = finish;
    } else gaps.add('invalid_duration');
    sessions.set(p.session_id, session);
  }
  const intervals: Record<string, Interval[]> = { [room.creator_user_id]: [], [room.fan_user_id]: [] };
  for (const session of sessions.values()) {
    if (session.joined === undefined || session.end === undefined || session.leftJoined === undefined || Math.abs(session.joined - session.leftJoined) > 0.1) { gaps.add('incomplete_session'); continue; }
    if (!Array.from(meetings.values()).some(m => m.start !== undefined && m.end !== undefined && session.joined! >= m.start - 1 && session.end! <= m.end + 1)) gaps.add('unmatched_meeting');
    const interval: Interval = [Math.max(from, session.joined, session.leftJoined!), Math.min(until, session.end)];
    if (interval[1] > interval[0]) intervals[session.user].push(interval);
  }
  if (!meetings.size || Array.from(meetings.values()).some(m => m.end === undefined)) gaps.add('incomplete_meeting');
  const creator = union(intervals[room.creator_user_id]), fan = union(intervals[room.fan_user_id]);
  let simultaneous = 0;
  for (const a of creator) for (const b of fan) simultaneous += Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));
  const seconds = (list: Interval[]) => list.reduce((sum, i) => sum + i[1] - i[0], 0);
  return { creator_seconds: seconds(creator), fan_seconds: seconds(fan), simultaneous_seconds: simultaneous,
    scheduled_seconds: until - from, evidence_status: gaps.size ? 'incomplete' : 'webhook_evidence', gaps: [...gaps].sort(),
    // Attendance alone never proves the promised service was delivered or authorizes settlement.
    settlement_eligible: false };
}
