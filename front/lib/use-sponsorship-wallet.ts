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
    if (!isAvailable || !wallet) { open(); throw new UserFacingError('Conecta tu wallet y vuelve a intentarlo.'); }
    await session.ensureSession();
    if (solana.publicKey !== wallet) throw new UserFacingError('La cuenta de Phantom cambió. Desconecta la wallet y vuelve a conectarla para autorizar la cuenta seleccionada.');
    async function post(body: unknown) {
      const response = await fetch('/api/sponsorships', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw responseError(response, result, 'No se pudo completar la operación. Vuelve a intentarlo.');
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
        throw new UserFacingError('Phantom no autorizó esta cuenta para Vynx. Pulsa Desconectar, selecciona la cuenta en Phantom y vuelve a conectar y aprobar el acceso. Después reintenta la operación.');
      }
      throw error;
    }
    if (result.publicKey !== wallet) throw new UserFacingError('La firma pertenece a otra cuenta. Desconecta y vuelve a conectar la wallet seleccionada.');
    const signature = Array.from(result.signature, b => b.toString(16).padStart(2, '0')).join('');
    return post({ action, payload, wallet, challenge: challenge.id, signature });
  }
  return { wallet, solana, open, signed };
}
