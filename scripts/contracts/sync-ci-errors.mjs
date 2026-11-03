import { readFileSync, writeFileSync } from 'node:fs';
const source=new URL('../../apps/api-backend/src/main/resources/ci/error-catalog-v1.json',import.meta.url);
const target=new URL('../../apps/console-web/src/lib/ci-error-catalog.json',import.meta.url);
// Canonical runtime resource -> standalone frontend Docker context. Tests enforce equality.
writeFileSync(target,readFileSync(source));
