'use client';
import { useCopy } from "@/i18n/copy";


import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWalletSession } from './WalletSessionProvider';
import { notificationEmail, type NotificationEmailSettings as EmailSettings } from '@/lib/notification-email';
import { responseError, userErrorMessage } from '@/lib/user-facing-error';

export default function NotificationEmailSettings() {
  const t = useCopy();
  const { wallet } = useWalletSession();
  const descriptionId = useId();
  const [snapshot, setSnapshot] = useState<{ wallet: string; settings: EmailSettings } | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const editedEmail = useRef(false);
  useEffect(() => {
    if (!wallet) return;
    const controller = new AbortController();
    fetch('/api/notification-email', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw responseError(response, result, t('Could not load your notification email.'));
        if (!controller.signal.aborted) {
          setSnapshot({ wallet, settings: result.settings });
          if (!editedEmail.current || result.settings.source === 'privy') setEmail(result.settings.email ?? '');
          setLoadFailed(false); setError('');
        }
      }).catch(reason => { if (!controller.signal.aborted) { setLoadFailed(true); setError(userErrorMessage(reason, t('Could not load your notification email.'))); } });
    return () => controller.abort();
  }, [wallet, retry, t]);
  const settings = snapshot?.wallet === wallet ? snapshot.settings : null;
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || !wallet || (!settings && !loadFailed) || settings?.source === 'privy') return;
    setError(''); setNotice('');
    let normalized;
    try { normalized = notificationEmail(email); }
    catch (reason) { setError(userErrorMessage(reason, t('Enter a valid email address.'))); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/notification-email', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet, email: normalized }) });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) setRetry(value => value + 1);
        throw responseError(response, result, t('Could not save your notification email. Your input is preserved.'));
      }
      setSnapshot({ wallet, settings: result.settings }); setEmail(result.settings.email ?? '');
      editedEmail.current = false; setLoadFailed(false);
      setNotice(result.settings.email ? t('Notification email saved.') : t('Notification email removed.'));
    } catch (reason) { setError(userErrorMessage(reason, t('Could not save your notification email. Your input is preserved.'))); }
    finally { setBusy(false); }
  }
  return <section aria-label={t("Email notifications")} className="min-w-0 space-y-3 rounded-xl border border-white/10 p-4">
    <div><h3 className="text-sm font-medium">{t("Email notifications")}</h3><p id={descriptionId} className="mt-2 text-xs leading-5 text-zinc-400">{t("Your notification address stays private and is not shown on your card.")}</p></div>
    {!settings && !loadFailed && <p role="status" className="text-xs text-zinc-400">{t("Loading notification email…")}</p>}
    <form onSubmit={event => void save(event)} className="space-y-3">
      <label className="block text-sm text-zinc-300">{t("Notification email")}<Input type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" value={email} readOnly={settings?.source === 'privy'} disabled={busy || (!settings && !loadFailed)} aria-describedby={descriptionId} onChange={event => { editedEmail.current = true; setEmail(event.target.value); setError(''); setNotice(''); }} className="mt-2 min-h-11 w-full border-white/15 bg-black/20 text-white" /></label>
      {settings?.source === 'privy' ? <p className="text-xs leading-5 text-violet-200">{t("Using the email linked to your Privy account.")}</p> : <><p className="text-xs leading-5 text-zinc-400">{t("Add an email to receive notifications. Clear this field and save to remove it.")}</p><Button type="submit" variant="outline" disabled={busy || !wallet || (!settings && !loadFailed) || email.trim() === (settings?.email ?? '')} className="min-h-11 w-full border-white/15 sm:w-auto">{busy ? t('Saving email…') : t('Save notification email')}</Button></>}
    </form>
    {notice && <p role="status" className="text-xs text-emerald-200">{t(notice)}</p>}
    {error && <p role="alert" className="text-xs text-red-300">{t(error)}</p>}
    {loadFailed && <Button type="button" variant="outline" disabled={busy} onClick={() => { setError(''); setLoadFailed(false); setRetry(value => value + 1); }} className="min-h-11">{t("Retry loading email")}</Button>}
  </section>;
}
