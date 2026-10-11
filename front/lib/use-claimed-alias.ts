'use client';
import { userErrorMessage, responseError } from '@/lib/user-facing-error';

import { useEffect, useState } from 'react';

export function useClaimedAlias(wallet: string) {
  const [snapshot, setSnapshot] = useState<{ wallet: string; alias: string; error: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!wallet) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/profile?wallet=${encodeURIComponent(wallet)}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
        const result = await response.json();
        if (!response.ok) throw responseError(response, result, "Could not check your alias. Try again.");
        if (!controller.signal.aborted) setSnapshot({ wallet, alias: result.profile?.username ?? '', error: '' });
      } catch (reason) {
        if (!controller.signal.aborted) setSnapshot({ wallet, alias: '', error: userErrorMessage(reason, "Could not check your alias.") });
      }
    }
    void load();
    return () => controller.abort();
  }, [wallet, attempt]);
  const current = snapshot?.wallet === wallet;
  return {
    alias: current ? snapshot.alias : '',
    loading: !!wallet && !current,
    error: current ? snapshot.error : '',
    retry: () => { setSnapshot(null); setAttempt(previous => previous + 1); },
  };
}
