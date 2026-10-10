export type TipCurrency = 'USDC' | 'SOL';
export const DEVNET_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

export function tipCurrency(value: unknown): TipCurrency {
  // Older SOL clients and recovery records omit currency.
  if (value === undefined || value === 'SOL') return 'SOL';
  if (value === 'USDC') return 'USDC';
  throw new Error('Choose USDC or SOL.');
}

export function tipUsdcUnits(value: unknown) {
  if (typeof value !== 'string' || !/^\d{1,4}(\.\d{1,6})?$/.test(value)) throw new Error('Enter a USDC amount with at most 6 decimal places.');
  const [whole, fraction = ''] = value.split('.');
  const units = Number(BigInt(whole) * BigInt(1_000_000) + BigInt(fraction.padEnd(6, '0')));
  if (units < 10_000 || units > 1_000_000_000) throw new Error('Tips must be between 0.01 and 1,000 USDC.');
  return units;
}

export function formatTipUnits(units: string | number, currency: TipCurrency) {
  const decimals = currency === 'USDC' ? 6 : 9;
  const scale = BigInt(10 ** decimals);
  const amount = BigInt(units);
  const fraction = (amount % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${amount / scale}${fraction ? `.${fraction}` : ''}`;
}
