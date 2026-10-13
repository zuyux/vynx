'use client';
import { useCopy } from "@/i18n/copy";


import Image from 'next/image';
import { useRouter } from '@/i18n/navigation';
import { walletOnboardingDestination } from '@/lib/wallet-onboarding';
import { clearGoogleSignIn, googleSignInPending } from '@/lib/google-sign-in-intent';
import { LogIn, X } from 'lucide-react';
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { getWallets } from '@wallet-standard/app';
import { WalletSessionContext, type SessionContext, type PrivySignInOptions } from './WalletSessionProvider';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { authenticateBrowserWallet, browserWallet, browserWalletAddress, restoreBrowserWallet, type BrowserAuthMethod, type BrowserSolanaProvider } from '@/lib/browser-wallet';
import { sendDevnetTransaction } from '@/lib/devnet-wallet';
import { UserFacingError, responseError } from '@/lib/user-facing-error';

type AuthMethod = BrowserAuthMethod | 'privy';
type ExternalSession = { method: BrowserAuthMethod; provider: BrowserSolanaProvider; address: string };

export function AuthMethodProvider({ children, privyLoading = false }: { children: ReactNode; privyLoading?: boolean }) {
  const t = useCopy();
  const router = useRouter();
  const privy = useContext(WalletSessionContext);
  const [method, setMethod] = useState<AuthMethod | null>(null);
  const [savedWallet, setSavedWallet] = useState('');
  const [restoringSession, setRestoringSession] = useState(true);
  const [external, setExternal] = useState<ExternalSession | null>(null);
  const currentExternal = useRef<ExternalSession | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [resumeError, setResumeError] = useState('');
  const pending = useRef<{ promise: Promise<string>; resolve: (address: string) => void; reject: (reason: unknown) => void } | null>(null);
  const operation = useRef<AbortController | null>(null);
  const initialRead = useRef<AbortController | null>(null);
  const revoking = useRef<Promise<void> | null>(null);

  const privyWallet = privy?.wallet ?? '';
  useEffect(() => {
    if (busy || pending.current || !privyWallet || !googleSignInPending()) return;
    const controller = new AbortController();
    void walletOnboardingDestination(privyWallet, controller.signal).then(destination => {
      if (controller.signal.aborted) return;
      clearGoogleSignIn();
      initialRead.current?.abort(); setRestoringSession(false);
      setMethod('privy');
      if (destination) router.replace(destination);
    }).catch(() => {
      if (!controller.signal.aborted) {
        clearGoogleSignIn();
        setResumeError(t('Unable to complete Google sign-in. Please sign in again.'));
        setOpen(true);
      }
    });
    return () => controller.abort();
  }, [privyWallet, busy, router, t]);

  useEffect(() => {
    const controller = new AbortController(); initialRead.current = controller;
    void fetch('/api/auth/session', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) })
      .then(async response => response.ok ? response.json() : { wallet: null })
      .then(session => {
        if (controller.signal.aborted) return;
        const address = session.wallet ?? '';
        setSavedWallet(address);
        const restored = restoreBrowserWallet(address);
        if (restored && !currentExternal.current) {
          currentExternal.current = restored; setExternal(restored); setMethod(restored.method);
        }
      })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setRestoringSession(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!external) return;
    const invalidate = (force = false) => {
      if (currentExternal.current !== external || (!force && browserWalletAddress(external.provider) === external.address)) return;
      currentExternal.current = null;
      setSavedWallet(''); setExternal(null); setMethod(null);
      revoking.current = fetch('/api/auth/session', { method: 'DELETE' }).then(() => {}).catch(() => {});
    };
    const accountChanged = () => invalidate(true);
    const disconnected = () => invalidate(true);
    external.provider.on?.('accountChanged', accountChanged);
    external.provider.on?.('disconnect', disconnected);
    return () => {
      external.provider.removeListener?.('accountChanged', accountChanged);
      external.provider.removeListener?.('disconnect', disconnected);
    };
  }, [external]);
  useEffect(() => () => {
    operation.current?.abort();
    pending.current?.reject(new UserFacingError(t('Sign-in interrupted.')));
    pending.current = null;
  }, [t]);

  function authenticate() {
    setResumeError('');
    if (privyLoading) return Promise.reject(new UserFacingError(t('Sign-in is loading. Please try again.')));
    if (pending.current) return pending.current.promise;
    let resolve!: (wallet: string) => void, reject!: (reason: unknown) => void;
    const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
    pending.current = { promise, resolve, reject };
    setOpen(true);
    return promise;
  }
  function cancel() {
    clearGoogleSignIn();
    operation.current?.abort();
    pending.current?.reject(new UserFacingError(t('Sign-in cancelled. Choose a method when you are ready.')));
    pending.current = null;
    setOpen(false); setBusy(false);
  }
  async function choose(chosen: AuthMethod, options?: PrivySignInOptions) {
    if (busy) return;
    const controller = new AbortController(); operation.current = controller;
    setBusy(true); initialRead.current?.abort(); setRestoringSession(false); setSavedWallet('');
    // Clear the visible authenticated identity while connecting the chosen method.
    currentExternal.current = null; setExternal(null); setMethod(null);
    try {
      await revoking.current;
      controller.signal.throwIfAborted();
      let address: string;
      if (chosen === 'privy') {
        if (!privy) throw new UserFacingError(t('Privy sign-in is unavailable. Choose a browser wallet.'));
        setOpen(false);
        address = options && privy.authenticateWithPrivy ? await privy.authenticateWithPrivy(options) : await privy.authenticate();
        controller.signal.throwIfAborted();
      } else {
        await privy?.deactivate?.();
        controller.signal.throwIfAborted();
        const provider = browserWallet(chosen);
        address = await authenticateBrowserWallet(provider, controller.signal);
        controller.signal.throwIfAborted();
        const session = { method: chosen, provider, address };
        currentExternal.current = session; setExternal(session);
      }
      const onboarding = await walletOnboardingDestination(address, controller.signal);
      controller.signal.throwIfAborted();
      clearGoogleSignIn();
      setMethod(chosen); setOpen(false);
      if (onboarding) router.replace(onboarding);
      pending.current?.resolve(address); pending.current = null;
    } catch (reason) {
      if (!controller.signal.aborted) {
        clearGoogleSignIn();
        pending.current?.reject(reason); pending.current = null; setOpen(false);
      }
    } finally { if (operation.current === controller) setBusy(false); }
  }
  const selectedMethod = method ?? (!busy && savedWallet && savedWallet === privyWallet ? 'privy' : null);
  async function ensureSession() {
    if (selectedMethod === 'privy' && privy) return privy.ensureSession();
    const session = currentExternal.current;
    if (session && browserWalletAddress(session.provider) !== session.address) return authenticate();
    // Reloads restore the app cookie before a sign-in method is selected again.
    // Cookie-authorized edits do not require a live wallet connection.
    const expectedWallet = session?.address || savedWallet;
    if (!expectedWallet) return authenticate();
    const response = await fetch('/api/auth/session', { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    const result = await response.json();
    if (!response.ok) throw responseError(response, result, t('Unable to verify sign-in.'));
    if (result.wallet === expectedWallet && (!session || browserWalletAddress(session.provider) === session.address)) return expectedWallet;
    if (!result.wallet && session && browserWalletAddress(session.provider) === session.address) {
      // Refresh an expired cookie with the already selected provider. Its signed
      // challenge is still required, but choosing a wallet again is unnecessary.
      return authenticateBrowserWallet(session.provider);
    }
    return authenticate();
  }
  async function logout() {
    initialRead.current?.abort(); setRestoringSession(false);
    cancel();
    if (privy) await privy.logout();
    else {
      const response = await fetch('/api/auth/session', { method: 'DELETE' });
      if (!response.ok) throw responseError(response, await response.json(), t('Unable to sign out.'));
    }
    await currentExternal.current?.provider.disconnect();
    currentExternal.current = null; setSavedWallet(''); setExternal(null); setMethod(null);
  }
  // A valid app cookie can authorize account pages, but it never counts as a
  // connected browser wallet or authorizes an alias redirect.
  const wallet = selectedMethod === 'privy' ? privy?.wallet ?? '' : external?.address ?? savedWallet;
  const context: SessionContext = {
    wallet, connectedWallet: selectedMethod === 'privy' ? privy?.connectedWallet ?? '' : external?.address ?? '',
    checking: busy || privyLoading || (restoringSession && !wallet), authenticate, signIn: ensureSession, ensureSession, logout,
    open: () => { void authenticate().catch(() => {}); },
    signMessage: async message => {
      if (selectedMethod === 'privy' && privy) return privy.signMessage(message);
      const session = currentExternal.current;
      if (!session || browserWalletAddress(session.provider) !== session.address) throw new UserFacingError(t('Reconnect your selected wallet first.'));
      const signed = await session.provider.signMessage(message);
      if (signed.publicKey.toBase58() !== session.address || browserWalletAddress(session.provider) !== session.address) throw new UserFacingError(t('Wallet changed during approval.'));
      return { publicKey: session.address, signature: signed.signature };
    },
    sendTransaction: async (transaction, address) => {
      if (selectedMethod === 'privy' && privy) return privy.sendTransaction(transaction, address);
      const session = currentExternal.current;
      if (!session || session.address !== address || browserWalletAddress(session.provider) !== address) throw new UserFacingError(t('Reconnect your selected wallet first.'));
      const selectedWallets = getWallets().get().filter(wallet => session.method === 'phantom' ? /^phantom$/i.test(wallet.name) : /brave/i.test(wallet.name));
      return sendDevnetTransaction(transaction, address, selectedWallets);
    },
  };
  return <WalletSessionContext.Provider value={context}>
    {children}
    <Dialog open={open} onOpenChange={value => { if (!value) cancel(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl border-white/15 bg-[#101015] text-white">
        <button type="button" onClick={cancel} aria-label={t("Close sign-in")} title={t("Close")} className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-lg text-zinc-400 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400"><X size={20} aria-hidden="true" /></button>
        <DialogTitle className="flex items-center gap-2 pr-8"><LogIn size={20} className="shrink-0" aria-hidden="true" />{t("Sign in")}</DialogTitle>
        <DialogDescription className="text-zinc-400">{t("Connect a browser wallet or sign in with Privy.")}</DialogDescription>
        {resumeError && <p role="alert" className="text-sm text-red-200">{t(resumeError)}</p>}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center gap-2">
            <button type="button" aria-label={t("Phantom")} disabled={busy || privyLoading} onClick={() => void choose('phantom')} className="flex aspect-square w-full max-w-32 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.03] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-400 disabled:opacity-50">
              <Image src="/wallets/phantom.svg" alt="" width={56} height={56} unoptimized aria-hidden="true" />
            </button>
            <span className="text-sm font-medium">{t("Phantom")}</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button type="button" aria-label="Brave Wallet" disabled={busy || privyLoading} onClick={() => void choose('brave')} className="flex aspect-square w-full max-w-32 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.03] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-400 disabled:opacity-50">
              <Image src="/wallets/brave.svg" alt="" width={56} height={56} unoptimized aria-hidden="true" />
            </button>
            <span className="text-sm font-medium">{t("Brave Wallet")}</span>
          </div>
        </div>
        <div className="border-t border-white/10 pt-4">
          <form onSubmit={event => { event.preventDefault(); void choose('privy', { method: 'email', email: email.trim() }); }} className="space-y-3">
            <label htmlFor="auth-email" className="block text-sm text-zinc-300">{t("Email")}</label>
            <input id="auth-email" name="email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" disabled={busy || privyLoading} className="w-full rounded-xl border border-white/15 bg-black/30 p-3 text-white outline-none focus:border-violet-400 disabled:opacity-50" />
            <button type="submit" disabled={busy || privyLoading || !privy || privy.checking} className="min-h-11 w-full rounded-xl bg-violet-400 p-3 font-semibold text-black disabled:opacity-50">{t("Continue with email")}</button>
          </form>
          <button type="button" disabled={busy || privyLoading || !privy || privy.checking} onClick={() => void choose('privy', { method: 'google' })} className="mt-3 flex min-h-11 w-full items-center justify-center gap-3 rounded-xl border border-white/15 p-3 hover:bg-white/5 disabled:opacity-50">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.23c1.89-1.74 2.99-4.31 2.99-7.36Z" /><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.23-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.41 13.92A6 6 0 0 1 6.1 12c0-.67.12-1.32.31-1.92V7.49H3.07A10 10 0 0 0 2 12c0 1.61.39 3.14 1.07 4.51l3.34-2.59Z" /><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z" /></svg>{t(" Continue with Google ")}</button>
          {(privyLoading || privy?.checking) && <p role="status" className="mt-3 text-xs text-zinc-400">{t("Loading email and Google sign-in…")}</p>}
          {!privyLoading && !privy && <p role="status" className="mt-3 text-xs text-zinc-400">{t("Email and Google sign-in are currently unavailable.")}</p>}
        </div>
        {busy && <p role="status" className="text-sm text-zinc-400">{t("Approve the connection and sign-in to continue.")}</p>}
      </DialogContent>
    </Dialog>
  </WalletSessionContext.Provider>;
}
