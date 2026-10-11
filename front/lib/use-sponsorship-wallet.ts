'use client';
import { UserFacingError, responseError } from '@/lib/user-facing-error';
import { AddressType, useAccounts, useModal, useSolana } from '@phantom/react-sdk';
import { useWalletSession } from '@/components/WalletSessionProvider';
import type { SponsorAction, SponsorPayload } from './sponsorship-domain';

export function useSponsorshipWallet() {
  const session = useWalletSession();
  const { solana, isAvailable } = useSolana();
  const accounts = useAccounts();
  const { open } = useModal();
  const wallet = accounts?.find(account => account.addressType === AddressType.solana)?.address ?? '';

  async function signed(action: SponsorAction, payload: SponsorPayload = {}) {
    if (!isAvailable || !wallet) { open(); throw new UserFacingError("Connect your wallet and try again."); }
    await session.ensureSession();
    if (solana.publicKey !== wallet) throw new UserFacingError("The Phantom account changed. Disconnect and reconnect your wallet to authorize the selected account.");
    async function post(body: unknown) {
      const response = await fetch('/api/sponsorships', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw responseError(response, result, "Could not complete the action. Try again.");
      return result;
    }
    const challenge = await post({ phase: 'challenge', action, payload, wallet });
    let result;
    try {
      result = await solana.signMessage(new TextEncoder().encode(challenge.message));
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
      const message = error instanceof Error ? error.message : '';
      if (code === 4100 || /not been authorized|unauthorized/i.test(message)) {
        throw new UserFacingError("Phantom did not authorize this account for Vynx. Select Disconnect, choose the account in Phantom, then reconnect and approve access. Retry the action afterward.");
      }
      throw error;
    }
    if (result.publicKey !== wallet) throw new UserFacingError("The signature belongs to another account. Disconnect and reconnect the selected wallet.");
    const signature = Array.from(result.signature, b => b.toString(16).padStart(2, '0')).join('');
    return post({ action, payload, wallet, challenge: challenge.id, signature });
  }
  return { wallet, solana, open, signed };
}
