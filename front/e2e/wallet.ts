import { createPrivateKey, sign } from 'node:crypto';
import { Keypair, Transaction } from '@solana/web3.js';
import type { BrowserContext, Page } from '@playwright/test';

export async function installWallet(context: BrowserContext, keypair = Keypair.generate()) {
  const secret = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from(keypair.secretKey.slice(0, 32))]), format: 'der', type: 'pkcs8' });
  await context.exposeBinding('walletTestBridge', async (_source, operation: string, data: string) => {
    if (operation === 'message') return { signature: Array.from(sign(null, Buffer.from(data, 'base64'), secret)) };
    const transaction = Transaction.from(Buffer.from(data, 'base64'));
    transaction.partialSign(keypair);
    const response = await fetch(`${process.env.E2E_FIXTURE_URL}/test/submit`, { method: 'POST', body: JSON.stringify({ transaction: transaction.serialize().toString('base64'), delay: 1 }) });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });
  await context.addInitScript(({ address, bytes }) => {
    const bridge = window as typeof window & {
      walletTestBridge: (operation: string, data: string) => Promise<{ signature: number[] | string }>;
      phantom: unknown; solana: unknown;
      walletTestCalls: { connect: number; message: number; transaction: number };
      walletTestReject: boolean;
      walletTestTransactionError: { message: string; code?: string | number } | null;
    };
    const listeners = new Map<string, Set<(...values: unknown[]) => void>>();
    const publicKey = { toString: () => address, toBase58: () => address, toBytes: () => new Uint8Array(bytes) };
    let connected = false;
    bridge.walletTestCalls = { connect: 0, message: 0, transaction: 0 };
    bridge.walletTestReject = false;
    bridge.walletTestTransactionError = null;
    const encode = (value: Uint8Array) => btoa(String.fromCharCode(...value));
    const provider = {
      isPhantom: true,
      get isConnected() { return connected; },
      get publicKey() { return connected ? publicKey : null; },
      async connect(options?: { onlyIfTrusted?: boolean }) {
        if (options?.onlyIfTrusted && !connected) throw new Error('Not trusted');
        bridge.walletTestCalls.connect++;
        connected = true;
        listeners.get('connect')?.forEach(listener => listener(publicKey));
        return { publicKey };
      },
      async disconnect() { connected = false; listeners.get('disconnect')?.forEach(listener => listener()); },
      async signMessage(message: Uint8Array) {
        bridge.walletTestCalls.message++;
        if (bridge.walletTestReject) { bridge.walletTestReject = false; throw new Error('User rejected the sign-in message'); }
        const result = await bridge.walletTestBridge('message', encode(message));
        return { signature: new Uint8Array(result.signature as number[]), publicKey };
      },
      async signAndSendTransaction(transaction: { serialize: (options: { requireAllSignatures: boolean }) => Uint8Array }) {
        bridge.walletTestCalls.transaction++;
        if (bridge.walletTestReject) { bridge.walletTestReject = false; throw Object.assign(new Error('User rejected the transaction'), { code: 4001 }); }
        if (bridge.walletTestTransactionError) {
          const error = bridge.walletTestTransactionError;
          bridge.walletTestTransactionError = null;
          throw Object.assign(new Error(error.message), { code: error.code });
        }
        return bridge.walletTestBridge('transaction', encode(transaction.serialize({ requireAllSignatures: false })));
      },
      on(event: string, listener: (...values: unknown[]) => void) { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event)!.add(listener); return provider; },
      off(event: string, listener: (...values: unknown[]) => void) { listeners.get(event)?.delete(listener); return provider; },
    };
    bridge.phantom = { solana: provider }; bridge.solana = provider;
    // Keep mainnet first to reproduce the SDK default-chain bug. Production
    // sends must explicitly select devnet rather than calling this SDK default.
    const account = { address, publicKey: new Uint8Array(bytes), chains: ['solana:mainnet', 'solana:devnet'], features: ['solana:signAndSendTransaction'] };
    const standardWallet = {
      version: '1.0.0', name: 'Phantom', icon: 'data:image/png;base64,AA==',
      chains: account.chains,
      get accounts() { return connected ? [account] : []; },
      features: { 'solana:signAndSendTransaction': { version: '1.0.0', supportedTransactionVersions: ['legacy'],
        async signAndSendTransaction(input: { chain: string; transaction: Uint8Array }) {
          if (input.chain !== 'solana:devnet') throw new Error('Wallet attempted to simulate on mainnet.');
          const result = await provider.signAndSendTransaction({ serialize: () => input.transaction });
          const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
          let value = BigInt(0); for (const character of result.signature as string) value = value * BigInt(58) + BigInt(alphabet.indexOf(character));
          const signature = new Uint8Array(64); for (let i = 63; i >= 0; i--) { signature[i] = Number(value % BigInt(256)); value /= BigInt(256); }
          return [{ signature }];
        },
      } },
    };
    const register = (api: { register: (...wallets: unknown[]) => unknown }) => api.register(standardWallet);
    window.addEventListener('wallet-standard:app-ready', event => register((event as CustomEvent).detail));
    window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', { detail: register }));
  }, { address: keypair.publicKey.toBase58(), bytes: Array.from(keypair.publicKey.toBytes()) });
  return keypair;
}
export async function connectWallet(page: Page) {
  await page.getByRole('button', { name: /^Connect wallet$/i }).click();
  await page.getByRole('button', { name: 'Phantom', exact: true }).click();
}
export async function signIn(page: Page, next = '/dashboard') {
  await page.goto(next);
  await connectWallet(page);
}
