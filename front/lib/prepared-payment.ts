import { ComputeBudgetProgram, Transaction, TransactionMessage, type VersionedTransactionResponse } from '@solana/web3.js';

// Wallets may refresh a blockhash, add fee settings, or use a v0 message.
// Payment instructions and their account privileges must remain identical.
export function matchesPreparedPayment(prepared: Transaction, landed: VersionedTransactionResponse) {
  try {
    const expected = TransactionMessage.decompile(prepared.compileMessage());
    const actual = TransactionMessage.decompile(landed.transaction.message,
      landed.meta?.loadedAddresses ? { accountKeysFromLookups: landed.meta.loadedAddresses } : undefined);
    if (!actual.payerKey.equals(expected.payerKey)) return false;
    const instructions = actual.instructions.filter(instruction => {
      if (!instruction.programId.equals(ComputeBudgetProgram.programId)) return true;
      // Permit only compute unit limit and price, without additional accounts.
      if (instruction.keys.length || !((instruction.data[0] === 2 && instruction.data.length === 5)
        || (instruction.data[0] === 3 && instruction.data.length === 9))) throw new Error('Unexpected fee instruction');
      return false;
    });
    return instructions.length === expected.instructions.length && instructions.every((instruction, index) => {
      const original = expected.instructions[index];
      return instruction.programId.equals(original.programId) && instruction.data.equals(original.data)
        && instruction.keys.length === original.keys.length && instruction.keys.every((key, position) => {
          const expectedKey = original.keys[position];
          return key.pubkey.equals(expectedKey.pubkey) && key.isSigner === expectedKey.isSigner && key.isWritable === expectedKey.isWritable;
        });
    });
  } catch { return false; }
}
