import { readFileSync } from 'node:fs';
const root = new URL('../../../', import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
export const policy = read('apps/api-backend/src/main/resources/ci/verdict-policy-v1.json');
export const catalogue = read('apps/api-backend/src/main/resources/ci/export-catalog-v1.json');
export const errors = read('apps/api-backend/src/main/resources/ci/error-catalog-v1.json').errors;
export const schemas = read('docs/ci/openapi-v1.json').components.schemas;
export const VERSION = '0.4.0-preview.2';
