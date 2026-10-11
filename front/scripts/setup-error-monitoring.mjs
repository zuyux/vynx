import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

// Never print the generated token. Preserve unrelated local configuration.
const path = '.env.local';
let source;
try { source = readFileSync(path, 'utf8'); }
catch (error) { if (error.code !== 'ENOENT') throw error; source = ''; }
if (!/^ERROR_MONITORING_TOKEN=.+$/m.test(source)) {
  source = source.replace(/^ERROR_MONITORING_TOKEN=.*\r?\n?/m, '');
  source += `\nERROR_MONITORING_TOKEN=${randomBytes(32).toString('hex')}\n`;
}
if (!/^ERROR_MONITORING_ENABLED=/m.test(source)) source += 'ERROR_MONITORING_ENABLED=false\n';
writeFileSync(path, source, { mode: 0o600 });
chmodSync(path, 0o600);
console.info('Local monitoring token configured. Apply migration 011, then set ERROR_MONITORING_ENABLED=true.');
