// scripts/check-licence.ts: opt-in live check, not part of the gate: asks testnet (WhatsOnChain) what the gate would answer
// for a public key. Usage: npm run check:licence -- <66-hex public key>
import { fileURLToPath } from 'node:url';
import { COLLECTION, ISSUER } from '../src/config';
import { fetchLicenceStatus } from '../src/services/licenceCheck';

async function main(): Promise<void> {
  const key = process.argv[2]?.trim().toLowerCase();
  if (!key || !/^0[23][0-9a-f]{64}$/.test(key)) {
    console.error('Usage: npm run check:licence -- <public key, 66 hex chars>');
    process.exitCode = 2;
    return;
  }
  console.log(`key ${key}\ncollection ${COLLECTION}, issuer ${ISSUER}, testnet`);
  const status = await fetchLicenceStatus(key);
  console.log(status.state);
  console.log(JSON.stringify(status));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
