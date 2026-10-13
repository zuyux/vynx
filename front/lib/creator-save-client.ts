import type { SessionContext } from '@/components/WalletSessionProvider';
import type { CreatorDraft } from './creator-draft';
import { responseError, UserFacingError } from './user-facing-error';

type ProfileSave = { design: CreatorDraft; published: boolean; tips_enabled: boolean; show_payer_addresses?: boolean };

export async function saveCreatorProfile(session: Pick<SessionContext, 'ensureSession' | 'signMessage'>, wallet: string, payload: ProfileSave) {
  // Snapshot the exact changes before opening the wallet approval dialog.
  const snapshot = JSON.parse(JSON.stringify(payload)) as ProfileSave;
  if (await session.ensureSession() !== wallet) throw new UserFacingError('Your wallet changed. Reload your profile before saving.');
  const patch = (body: unknown) => fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const challengeResponse = await patch({ ...snapshot, phase: 'challenge' });
  const challenge = await challengeResponse.json();
  if (!challengeResponse.ok) throw responseError(challengeResponse, challenge, 'Could not prepare wallet approval. Your draft is preserved.');
  if (!challenge.required) return patch(snapshot);
  const signed = await session.signMessage(new TextEncoder().encode(challenge.message));
  if (signed.publicKey !== wallet || await session.ensureSession() !== wallet) throw new UserFacingError('Your wallet changed during approval. Your changes have not been saved.');
  const signature = Array.from(signed.signature, byte => byte.toString(16).padStart(2, '0')).join('');
  return patch({ ...snapshot, challenge: challenge.id, signature });
}
