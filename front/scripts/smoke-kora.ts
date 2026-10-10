import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { aliasConnection } from '../lib/alias-network';
import { appDb } from '../lib/app-db';
import { koraRpc, sponsorTipTransaction } from '../lib/kora';
import { buildTip, confirmTip } from '../lib/tip-server';
import { DEVNET_USDC_MINT } from '../lib/tip-currency';
import { MEMO_PROGRAM } from '../lib/sol-payment';
import { verifyUsdcPayment } from '../lib/usdc-payment';

async function main() {
  const fanPath = process.env.KORA_TEST_FAN_KEYPAIR_PATH || join(homedir(), '.config/vynx-kora/test-fan.json');
  const fan = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(fanPath, 'utf8'))));
  const connection = await aliasConnection();
  const { signer_address } = await koraRpc<{ signer_address: string }>('getPayerSigner');
  console.log(`Kora sponsor: ${signer_address}`);
  console.log(`Sponsor balance: ${(await connection.getBalance(new PublicKey(signer_address))) / 1e9} devnet SOL`);
  const fanBalance = await connection.getBalance(fan.publicKey);
  console.log(`Test fan: ${fan.publicKey.toBase58()} · ${fanBalance / 1e9} devnet SOL`);
  if (fanBalance !== 0) throw new Error('Use a zero-SOL test fan to demonstrate fee sponsorship.');

  const mint = new PublicKey(DEVNET_USDC_MINT);
  const source = getAssociatedTokenAddressSync(mint, fan.publicKey);
  const tokenAccount = await connection.getAccountInfo(source);
  const usdcUnits = tokenAccount ? (await connection.getTokenAccountBalance(source)).value.amount : '0';
  console.log(`Test fan USDC units: ${usdcUnits}`);

  if (process.argv.includes('--usdc')) {
    if (BigInt(usdcUnits) < BigInt(10000)) throw new Error('Fund this test fan with devnet USDC through Circle before running --usdc.');
    const { data, error } = await appDb().from('cards_users').select('username').eq('published', true).neq('wallet_address', fan.publicKey.toBase58()).limit(1);
    if (error) throw new Error('Creator lookup failed.');
    if (!data?.[0]) {
      const recipientPath = join(homedir(), '.config/vynx-kora/test-recipient.json');
      if (!existsSync(recipientPath)) writeFileSync(recipientPath, JSON.stringify(Array.from(Keypair.generate().secretKey)), { mode: 0o600 });
      const recipient = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(recipientPath, 'utf8'))));
      const destination = getAssociatedTokenAddressSync(mint, recipient.publicKey);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      const feePayer = new PublicKey(signer_address);
      const memo = 'vynx:tip:kora-live-smoke';
      const transaction = new Transaction({ feePayer, blockhash, lastValidBlockHeight }).add(
        createAssociatedTokenAccountIdempotentInstruction(feePayer, destination, recipient.publicKey, mint),
        createTransferCheckedInstruction(source, mint, destination, fan.publicKey, 10000, 6),
        new TransactionInstruction({ programId: MEMO_PROGRAM, keys: [], data: Buffer.from(memo) }),
      );
      const signed = Transaction.from(Buffer.from(await sponsorTipTransaction(transaction, fan.publicKey.toBase58()), 'base64'));
      signed.partialSign(fan);
      const signature = await connection.sendRawTransaction(signed.serialize(), { preflightCommitment: 'confirmed', skipPreflight: false });
      const confirmation = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
      if (confirmation.value.err) throw new Error(`USDC transfer failed; signature: ${signature}`);
      let receipt = await connection.getParsedTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
      for (let attempt = 0; !receipt && attempt < 5; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        receipt = await connection.getParsedTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
      }
      verifyUsdcPayment(receipt, fan.publicKey.toBase58(), recipient.publicKey.toBase58(), 10000, memo);
      if (await connection.getBalance(fan.publicKey) !== 0) throw new Error('Test fan SOL balance unexpectedly changed.');
      console.log(`No published creator cards; verified 0.01 USDC transfer to dedicated test recipient ${recipient.publicKey.toBase58()}: ${signature}`);
      return;
    }
    const alias = data[0].username;
    const payment = await buildTip(alias, fan.publicKey.toBase58(), '0.01', 'USDC');
    const transaction = Transaction.from(Buffer.from(payment.transaction, 'base64'));
    transaction.partialSign(fan);
    const signature = await connection.sendRawTransaction(transaction.serialize(), { preflightCommitment: 'confirmed', skipPreflight: false });
    const confirmed = await connection.confirmTransaction({ signature, blockhash: payment.blockhash, lastValidBlockHeight: payment.lastValidBlockHeight }, 'confirmed');
    if (confirmed.value.err) throw new Error(`USDC tip failed; signature: ${signature}`);
    await confirmTip(alias, fan.publicKey.toBase58(), '0.01', signature, 'USDC');
    console.log(`Verified and recorded 0.01 USDC tip to @${alias}: ${signature}`);
    return;
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const original = new Transaction({ feePayer: new PublicKey(signer_address), blockhash, lastValidBlockHeight }).add(new TransactionInstruction({
    programId: MEMO_PROGRAM, data: Buffer.from('vynx:kora:devnet-smoke'), keys: [{ pubkey: fan.publicKey, isSigner: true, isWritable: false }],
  }));
  const serialized = await sponsorTipTransaction(original, fan.publicKey.toBase58());
  const signed = Transaction.from(Buffer.from(serialized, 'base64'));
  signed.partialSign(fan);
  const signature = await connection.sendRawTransaction(signed.serialize(), { preflightCommitment: 'confirmed', skipPreflight: false });
  const confirmation = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
  if (confirmation.value.err) throw new Error(`Sponsored transaction failed; signature: ${signature}`);
  if (await connection.getBalance(fan.publicKey) !== 0) throw new Error('Test fan SOL balance unexpectedly changed.');
  console.log(`Live Kora sponsorship confirmed with a zero-SOL fan: ${signature}`);
}

main().catch(reason => { console.error(reason instanceof Error ? reason.message : 'Kora verification failed.'); process.exitCode = 1; });
