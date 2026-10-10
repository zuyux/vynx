import { appDb } from '../lib/app-db';
import { processCreatorImageCleanup, discoverCreatorImageOrphans } from '../lib/creator-image-cleanup';
async function main() {
  const args = process.argv.slice(2);
  const limit = Number(args.find(arg => arg !== '--discover') ?? 100);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw Error('Provide a batch size between 1 and 200.');
  const db = appDb();
  if (args.includes('--discover')) console.log(JSON.stringify(await discoverCreatorImageOrphans(db, limit)));
  const result = await processCreatorImageCleanup(db, { limit });
  console.log(JSON.stringify(result));
  if (result.failed || result.blocked) process.exitCode = 1;
}
main().catch(() => { console.error('Image cleanup failed. Verify migration 007 and server-only Supabase configuration.'); process.exitCode = 1; });
