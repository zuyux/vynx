type LinkedAccount = { type: string; address?: string; chainType?: string; walletClientType?: string };

export function selectPrivySolanaWallet<T extends { address: string }>(
  wallets: readonly T[], accounts: readonly LinkedAccount[], primaryAddress?: string,
) {
  const linked = accounts.filter(account => account.type === 'wallet' && account.chainType === 'solana');
  const connected = (address?: string) => wallets.find(wallet => wallet.address === address);
  const primary = linked.find(account => account.address === primaryAddress);
  return (primary && connected(primary.address))
    ?? linked.filter(account => account.walletClientType === 'privy').map(account => connected(account.address)).find(Boolean)
    ?? linked.map(account => connected(account.address)).find(Boolean);
}

export function canRestorePrivyEmbeddedSession(address: string, walletName: string | undefined, sessionWallet: unknown) {
  return !!address && walletName === 'Privy' && sessionWallet === address;
}
