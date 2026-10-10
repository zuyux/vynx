'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useWalletSession } from '@/components/WalletSessionProvider';

export default function SponsorshipWalletControl({ fullWidthOnMobile = false }: { fullWidthOnMobile?: boolean }) {
  const session = useWalletSession();
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true); setError('');
    try { await session.logout(); router.replace('/'); router.refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to disconnect. Retry.'); }
    finally { setBusy(false); }
  }
  async function login() {
    setBusy(true); setError('');
    try { await session.authenticate(); router.refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to sign in. Retry.'); }
    finally { setBusy(false); }
  }
  const wallet = session.wallet || session.connectedWallet;
  return <div className={`flex flex-col gap-2 ${fullWidthOnMobile ? 'w-full items-stretch sm:w-auto sm:items-end' : 'items-end'}`}><div className={`flex gap-3 ${fullWidthOnMobile ? 'w-full flex-col items-stretch sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end [&_button]:min-h-11 [&_button]:w-full [&_button]:rounded-xl [&_button]:border [&_button]:border-white/15 [&_button]:px-4 [&_button]:py-3 sm:[&_button]:w-auto' : 'flex-wrap items-center justify-end'}`}>
    {wallet && <span className="text-xs text-zinc-400" title={wallet}>{wallet.slice(0,5)}…{wallet.slice(-4)}</span>}
    {session.wallet ? <><button type="button" onClick={session.open} className="text-xs text-zinc-400">{session.connectedWallet ? 'Cambiar wallet' : 'Conectar Phantom'}</button><button type="button" disabled={busy} onClick={() => void logout()} className="rounded-xl border border-white/15 px-4 py-2 text-sm disabled:opacity-40">{busy ? 'Desconectando…' : 'Desconectar'}</button></> : <button type="button" disabled={busy} onClick={() => void login()} className="rounded-xl border border-white/15 px-4 py-2 text-sm disabled:opacity-40">{busy ? 'Signing in…' : 'Iniciar sesión'}</button>}
  </div>{error && <p role="alert" className="max-w-xs text-xs text-red-200">{error}</p>}</div>;
}
