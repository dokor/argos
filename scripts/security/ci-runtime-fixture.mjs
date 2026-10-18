// Fixture-only trust store; run the unchanged production HTTP service afterwards.
import { mkdirSync,cpSync } from 'node:fs';
import { join } from 'node:path';
const location=join(process.env.HOME,'.pki','nssdb');
mkdirSync(location,{recursive:true});cpSync('/fixture-nssdb',location,{recursive:true});
await import('/app/server.mjs');
