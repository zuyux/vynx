import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import bs58 from 'bs58';
import { ComputeBudgetProgram, Keypair, PublicKey, SystemProgram, Transaction, VersionedTransaction } from '@solana/web3.js';
import { appDb } from './app-db';
import { normalizeAlias } from './alias';
import { aliasConnection } from './alias-network';
import { claimRpc, claimRpcFetch } from './claim-rpc';
import { checkClaim } from './alias-claim-legacy';
import { ApiError } from './wallet-session';
import { walletKey } from './sponsorship-server';
import { validPaymentSignature } from './sol-payment';
import { aliasPda, configPda, decodeConfig, ownerPda, verifyOwnershipAccounts, registerInstruction, REGISTRY_PROGRAM, registryEnabled, solPrice } from './alias-registry';

export const registryConnection = () => claimRpc(() => aliasConnection({ fetch: claimRpcFetch, disableRetryOnRateLimit: true }));
export async function assertRegistryOwnership(wallet: string, alias: string) {
  if (!registryEnabled()) return;
  const connection = await registryConnection();
  const name = normalizeAlias(alias);
  const owner = walletKey(wallet);
  const [record, index] = await claimRpc(() => connection.getMultipleAccountsInfo([aliasPda(name), ownerPda(owner)], 'confirmed'));
  try { return verifyOwnershipAccounts(name, owner, record, index); }
  catch (reason) {
    if (reason instanceof ApiError) throw reason;
    throw new ApiError('This alias has no matching on-chain ownership. Existing claims need migration before editing or publishing.', 409, 'REGISTRY_MIGRATION_REQUIRED');
  }
}
export async function registrationQuote(value: unknown) {
  const alias = normalizeAlias(value);
  const connection = await registryConnection();
  const info = await claimRpc(() => connection.getAccountInfo(configPda(), 'confirmed'));
  let config;
  try { config = decodeConfig(info); } catch { throw new ApiError('Registry pricing is unavailable.', 503, 'REGISTRY_UNAVAILABLE'); }
  if (config.paused) throw new ApiError('Alias registration is paused. Please try again later.', 503, 'REGISTRY_PAUSED');
  const price = config.tiers[Math.min(alias.length, 5) - 1];
  return { alias, priceLamports: price.toString(), priceSol: solPrice(price), priceVersion: config.version.toString(), sponsored: true, fullySponsored: true, connection, config };
}
function sponsorKey() {
  try {
    const secret = process.env.VYNX_ALIAS_SPONSOR_SECRET_KEY;
    const path = process.env.VYNX_ALIAS_SPONSOR_KEYPAIR_PATH;
    if (!!secret === !!path) throw new Error('Configure one sponsor key source.');
    const values = JSON.parse(secret ?? readFileSync(path!, 'utf8'));
    if (!Array.isArray(values) || values.length !== 64 || values.some(v => !Number.isInteger(v) || v < 0 || v > 255)) throw new Error('Invalid sponsor key.');
    return Keypair.fromSecretKey(Uint8Array.from(values));
  } catch { throw new ApiError('Registration sponsorship is unavailable.', 503, 'SPONSOR_UNAVAILABLE'); }
}
type Intent = { id: string; wallet: string; alias: string; transaction: string; signature: string; blockhash: string; last_valid_block_height: number; expires_at_slot: number; price_lamports: number; price_version: string; sponsor: string; treasury: string; reserved_fee: number; state?: string };
const payment = (intent: Intent) => ({ alias: intent.alias, transaction: intent.transaction, signature: intent.signature, blockhash: intent.blockhash, lastValidBlockHeight: intent.last_valid_block_height, expiresAtSlot: intent.expires_at_slot, priceLamports: String(intent.price_lamports), priceVersion: String(intent.price_version), priceSol: solPrice(BigInt(intent.price_lamports)), sponsored: true, fullySponsored: Transaction.from(Buffer.from(intent.transaction, 'base64')).instructions.some(ix => ix.programId.equals(SystemProgram.programId)) });
async function pendingIntent(wallet: string) {
  const { data, error } = await appDb().from('alias_registration_intents').select('*').eq('wallet', wallet).eq('state', 'prepared').maybeSingle();
  if (error) throw new ApiError('Registration storage is unavailable.', 503, 'CLAIM_UNAVAILABLE');
  return data as Intent | null;
}
async function settlePending(intent: Intent, connection: Awaited<ReturnType<typeof registryConnection>>) {
  const status = await claimRpc(() => connection.getSignatureStatuses([intent.signature], { searchTransactionHistory: true }));
  const result = status.value[0];
  if (result && !result.err) throw new ApiError('A registration was already sent. Verify its signature before preparing another claim.', 409, 'PAYMENT_PENDING');
  // A signed transaction remains spendable until the blockhash expires, even
  // after a failed fork or price change. Never release its reservation early.
  const height = await claimRpc(() => connection.getBlockHeight('confirmed'));
  if (height <= intent.last_valid_block_height) return false;
  const { error } = await appDb().from('alias_registration_intents').update({ state: result?.err ? 'failed' : 'expired' }).eq('id', intent.id).eq('state', 'prepared');
  if (error) throw new ApiError('Unable to reconcile registration. Retry verification.', 503);
  return true;
}
export async function buildRegistration(value: unknown, account: string, expected?: { priceLamports?: unknown; priceVersion?: unknown }) {
  const quote = await registrationQuote(value);
  const { alias, connection, config } = quote;
  const owner = walletKey(account);
  if (expected?.priceLamports !== quote.priceLamports || expected?.priceVersion !== quote.priceVersion) throw new ApiError('On-chain pricing changed. Refresh the quote before approving.', 409, 'PRICE_CHANGED');
  const pending = await pendingIntent(account);
  if (pending && !await settlePending(pending, connection)) {
    if (!payment(pending).fullySponsored || pending.alias !== alias || pending.sponsor !== config.sponsor.toBase58() || pending.treasury !== config.treasury.toBase58() || String(pending.price_lamports) !== quote.priceLamports || String(pending.price_version) !== quote.priceVersion) throw new ApiError('An earlier registration is still valid. Wait for its blockhash to expire or verify its signature.', 409, 'REGISTRATION_PENDING');
    return payment(pending);
  }
  const [aliasInfo, ownerInfo] = await claimRpc(() => connection.getMultipleAccountsInfo([aliasPda(alias), ownerPda(owner)], 'confirmed'));
  if (ownerInfo?.owner.equals(REGISTRY_PROGRAM)) throw new ApiError('Your wallet already owns an on-chain alias. Verify the original registration to restore its profile.', 409, 'WALLET_HAS_ALIAS');
  if (aliasInfo?.owner.equals(REGISTRY_PROGRAM)) throw new ApiError('This alias is already taken.', 409, 'ALIAS_TAKEN');
  const rows = await checkClaim(alias, account);
  if (rows.some(row => row.wallet_address === account)) throw new ApiError('Your existing alias needs migration. Contact support before registering another.', 409, 'REGISTRY_MIGRATION_REQUIRED');
  if (rows.length) throw new ApiError('This alias is reserved by an existing claim.', 409, 'ALIAS_TAKEN');
  const sponsor = sponsorKey();
  if (!sponsor.publicKey.equals(config.sponsor)) throw new ApiError('Sponsor configuration does not match the registry.', 503, 'SPONSOR_UNAVAILABLE');
  if (owner.equals(config.sponsor) || owner.equals(config.treasury)) throw new ApiError('Use a creator wallet distinct from the sponsor and treasury.');
  const price = BigInt(quote.priceLamports);
  const [latest, slot] = await Promise.all([
    claimRpc(() => connection.getLatestBlockhash('confirmed')),
    claimRpc(() => connection.getSlot('confirmed')),
  ]);
  const id = randomUUID();
  const transaction = new Transaction({ feePayer: sponsor.publicKey, ...latest });
  transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 }));
  // Funding and registration are atomic: a rejected claim rolls back the funding.
  transaction.add(SystemProgram.transfer({ fromPubkey: sponsor.publicKey, toPubkey: owner, lamports: price }));
  transaction.add(registerInstruction(owner, config.sponsor, config.treasury, alias, price, config.version, BigInt(slot + 100), Buffer.from(id.replaceAll('-', ''), 'hex')));
  const fee = (await claimRpc(() => connection.getFeeForMessage(transaction.compileMessage(), 'confirmed'))).value;
  if (!fee || fee > 50_000 || await claimRpc(() => connection.getBalance(sponsor.publicKey, 'confirmed')) < Number(price) + fee) throw new ApiError('Registration sponsorship is temporarily unavailable.', 503, 'SPONSOR_UNAVAILABLE');
  const simulation = await claimRpc(() => connection.simulateTransaction(new VersionedTransaction(transaction.compileMessage()), { sigVerify: false, replaceRecentBlockhash: false, commitment: 'confirmed' }));
  if (simulation.value.err) throw new ApiError('The registry rejected this registration. Refresh its price and check alias availability before approving.', 409, 'REGISTRATION_REJECTED');
  transaction.partialSign(sponsor);
  const intent: Intent = { id, wallet: account, alias, transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'), signature: bs58.encode(transaction.signature!), blockhash: latest.blockhash, last_valid_block_height: latest.lastValidBlockHeight, expires_at_slot: slot + 100, price_lamports: Number(price), price_version: quote.priceVersion, sponsor: config.sponsor.toBase58(), treasury: config.treasury.toBase58(), reserved_fee: fee };
  const budget = Number(process.env.VYNX_ALIAS_SPONSOR_DAILY_BUDGET_LAMPORTS ?? '1000000000');
  if (!Number.isSafeInteger(budget) || budget < 1) throw new ApiError('Sponsorship budget is unavailable.', 503);
  const { data, error } = await appDb().rpc('reserve_alias_registration', { candidate: intent, daily_budget: budget });
  if (error) throw new ApiError('Unable to reserve registration. Please retry.', 503, 'CLAIM_UNAVAILABLE');
  if (!data?.accepted) {
    if (data?.existing?.alias === alias && payment(data.existing).fullySponsored && data.existing.sponsor === config.sponsor.toBase58() && data.existing.treasury === config.treasury.toBase58() && String(data.existing.price_lamports) === quote.priceLamports && String(data.existing.price_version) === quote.priceVersion) return payment(data.existing);
    throw new ApiError(data?.limited ? 'Sponsorship limit reached. Please try again later.' : 'Your wallet has a pending registration. Verify it before trying again.', 429, 'REGISTRATION_PENDING');
  }
  return payment(intent);
}
export async function confirmRegistration(value: unknown, account: string, signature: string) {
  const alias = normalizeAlias(value);
  const owner = walletKey(account);
  if (!validPaymentSignature(signature)) throw new ApiError('Invalid registration signature.', 400, 'INVALID_SIGNATURE');
  const { data: intent, error } = await appDb().from('alias_registration_intents').select('*').eq('signature', signature).eq('wallet', account).eq('alias', alias).maybeSingle();
  if (error) throw new ApiError('Registration storage is unavailable.', 503);
  if (!intent) throw new ApiError('This signature is not a sponsored registry registration.', 400, 'PAYMENT_MISMATCH');
  const connection = await registryConnection();
  const tx = await claimRpc(() => connection.getTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 }));
  if (!tx) {
    if (await claimRpc(() => connection.getBlockHeight('confirmed')) > intent.last_valid_block_height) {
      // Checking the PDAs as well avoids treating a missing historical RPC
      // transaction as permission to pay again after a successful registration.
      const infos = await claimRpc(() => connection.getMultipleAccountsInfo([aliasPda(alias), ownerPda(owner)], 'confirmed'));
      if (!infos.some(info => info?.owner.equals(REGISTRY_PROGRAM))) {
        const { error: expiryError } = await appDb().from('alias_registration_intents').update({ state: 'expired' }).eq('id', intent.id).eq('state', 'prepared');
        if (expiryError) throw new ApiError('Unable to reconcile expired registration.', 503);
        throw new ApiError('Registration expired without being recorded. Refresh the price and try again.', 409, 'QUOTE_EXPIRED');
      }
    }
    throw new ApiError('Registration is still confirming. Retry verification without paying again.', 409, 'PAYMENT_PENDING');
  }
  if (tx.meta?.err) throw new ApiError('The registry transaction failed. No alias was registered.', 400, 'PAYMENT_FAILED');
  let record;
  try {
    const original = Transaction.from(Buffer.from(intent.transaction, 'base64'));
    const message = tx.transaction.message;
    if (message.version !== 'legacy' || !Buffer.from(message.serialize()).equals(original.serializeMessage()) || tx.transaction.signatures[0] !== signature || message.header.numRequiredSignatures !== 2 || !message.accountKeys[0].equals(new PublicKey(intent.sponsor))) throw new Error('Registration transaction mismatch.');
    const [aliasInfo, ownerInfo] = await claimRpc(() => connection.getMultipleAccountsInfo([aliasPda(alias), ownerPda(owner)], 'confirmed'));
    record = verifyOwnershipAccounts(alias, owner, aliasInfo, ownerInfo);
    const ownerPosition = message.accountKeys.findIndex(key => key.equals(owner));
    if (!tx.meta || ownerPosition < 0 || tx.meta.preBalances[ownerPosition] - tx.meta.postBalances[ownerPosition] !== (payment(intent).fullySponsored ? 0 : Number(intent.price_lamports)) || record.price !== BigInt(intent.price_lamports) || record.version !== BigInt(intent.price_version) || record.intent !== intent.id.replaceAll('-', '') || record.slot !== BigInt(tx.slot) || tx.meta.fee > intent.reserved_fee) throw new Error('Registration receipt mismatch.');
  } catch (reason) {
    if (reason instanceof ApiError) throw reason;
    throw new ApiError('Registration or ownership PDAs do not match this claim. Keep the signature and contact support.', 400, 'PAYMENT_MISMATCH');
  }
  const existing = await checkClaim(alias, account);
  const same = existing.find(row => row.username === alias && row.wallet_address === account && row.tx_signature === signature);
  if (!same) {
    if (existing.length) throw new ApiError('An existing profile conflicts with this registration. Keep the signature and contact support.', 409, 'CLAIM_UNAVAILABLE');
    const { error: insertError } = await appDb().from('cards_users').insert({ username: alias, wallet_address: account, tx_signature: signature, claim_cluster: 'devnet', claim_lamports: Number(record.price), claim_treasury: intent.treasury, claim_verified_at: new Date().toISOString(), claim_program: REGISTRY_PROGRAM.toBase58(), claim_alias_pda: aliasPda(alias).toBase58(), claim_owner_pda: ownerPda(owner).toBase58(), claim_price_version: intent.price_version });
    if (insertError && !(await checkClaim(alias, account)).some(row => row.username === alias && row.wallet_address === account && row.tx_signature === signature)) throw new ApiError('Unable to save your alias profile. Retry verification without paying again.', 503, 'CLAIM_UNAVAILABLE');
  }
  const { error: receiptError } = await appDb().from('alias_registration_intents').update({ state: 'confirmed' }).eq('id', intent.id);
  if (receiptError) throw new ApiError('Unable to finish the registration receipt. Retry verification without paying again.', 503);
  return { alias, ok: true };
}
