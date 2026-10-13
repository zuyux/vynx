'use client';
import { useCopy } from "@/i18n/copy";

import { userErrorMessage } from '@/lib/user-facing-error';

import { LoaderCircle, LogOut, LogIn } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { useState } from 'react';
import { useWalletSession } from '@/components/WalletSessionProvider';

export default function SponsorshipWalletControl({ fullWidthOnMobile = false, iconOnly = false }: { fullWidthOnMobile?: boolean; iconOnly?: boolean }) {
  const t = useCopy();
  const session = useWalletSession();
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true); setError('');
    try { await session.logout(); router.replace('/'); router.refresh(); }
    catch (reason) { setError(userErrorMessage(reason, t('Unable to disconnect. Retry.'))); }
    finally { setBusy(false); }
  }
  async function login() {
    setBusy(true); setError('');
    try { await session.authenticate(); router.refresh(); }
    catch (reason) { setError(userErrorMessage(reason, t('Unable to sign in. Retry.'))); }
    finally { setBusy(false); }
  }
  const wallet = session.wallet || session.connectedWallet;
  if (iconOnly) return <div className="flex flex-col items-end gap-2">
    <button type="button" disabled={busy} onClick={() => void (session.wallet ? logout() : login())} aria-label={busy ? (session.wallet ? t('Disconnecting…') : t('Signing in…')) : (session.wallet ? t('Disconnect') : t('Sign in'))} title={session.wallet ? t('Disconnect') : t('Sign in')} className="flex size-11 items-center justify-center rounded-full border border-white/15 bg-[#101015]/95 text-zinc-300 shadow-lg backdrop-blur-md transition hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:opacity-40">
      {busy ? <LoaderCircle size={19} className="animate-spin" aria-hidden="true" /> : session.wallet ? <LogOut size={19} aria-hidden="true" /> : <LogIn size={19} aria-hidden="true" />}
    </button>{error && <p role="alert" className="max-w-xs rounded-xl border border-red-400/20 bg-[#101015] p-3 text-xs text-red-200">{t(error)}</p>}
  </div>;
  return <div className={`flex flex-col gap-2 ${fullWidthOnMobile ? 'w-full items-stretch sm:w-auto sm:items-end' : 'items-end'}`}><div className={`flex gap-3 ${fullWidthOnMobile ? 'w-full flex-col items-stretch sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end [&_button]:min-h-11 [&_button]:w-full [&_button]:rounded-xl [&_button]:border [&_button]:border-white/15 [&_button]:px-4 [&_button]:py-3 sm:[&_button]:w-auto' : 'flex-wrap items-center justify-end'}`}>
    {wallet && <span className="text-xs text-zinc-400" title={wallet}>{wallet.slice(0,5)}…{wallet.slice(-4)}</span>}
    {session.wallet ? <><button type="button" onClick={session.open} className="text-xs text-zinc-400">{session.connectedWallet ? t('Switch wallet') : t("Connect wallet")}</button><button type="button" disabled={busy} onClick={() => void logout()} className="rounded-xl border border-white/15 px-4 py-2 text-sm disabled:opacity-40">{busy ? t('Disconnecting…') : t("Disconnect")}</button></> : <button type="button" disabled={busy} onClick={() => void login()} className="rounded-xl border border-white/15 px-4 py-2 text-sm disabled:opacity-40">{busy ? t('Signing in…') : t("Sign in")}</button>}
  </div>{error && <p role="alert" className="max-w-xs text-xs text-red-200">{t(error)}</p>}</div>;
}
