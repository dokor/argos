import * as fs from 'node:fs';
import { resolve, dirname, parse, join } from 'node:path';
import { createHash } from 'node:crypto';
import { VERSION } from './resources.mjs';
import { exact, digest, timestamp, validResponse } from './contracts.mjs';
import { requireValue, Failure } from './diagnostics.mjs';

export const MAX_BYTES = 65536;
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function safeDirectory(path) {
  try {
  const absolute = resolve(path), root = parse(absolute).root;
  let current = root;
  for (const part of absolute.slice(root.length).split(/[\\/]/).filter(Boolean)) {
    current = join(current, part);
    const stat = fs.lstatSync(current);
    requireValue(stat.isDirectory() && !stat.isSymbolicLink(), 'ARTIFACT_INVALID');
  }
  return absolute;
  } catch { throw new Failure('ARTIFACT_INVALID'); }
}
export function writePrivate(path, value) {
  try {
  safeDirectory(dirname(resolve(path)));
  const bytes = Buffer.from(JSON.stringify(value) + '\n');
  requireValue(bytes.length <= MAX_BYTES, 'ARTIFACT_INVALID');
  const fd = fs.openSync(path, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW ?? 0), 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  return hash(bytes);
  } catch { throw new Failure('ARTIFACT_INVALID'); }
}
export function readTrusted(path, expected) {
  requireValue(digest(expected.digest), 'ARTIFACT_INVALID');
  safeDirectory(dirname(resolve(path)));
  const before = fs.lstatSync(path); let fd;
  try {
    requireValue(before.isFile() && !before.isSymbolicLink() && before.nlink === 1 && before.size > 0 && before.size <= MAX_BYTES, 'ARTIFACT_INVALID');
    fd = fs.openSync(path, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    const opened = fs.fstatSync(fd);
    requireValue(opened.isFile() && opened.dev === before.dev && opened.ino === before.ino && opened.size === before.size, 'ARTIFACT_INVALID');
    const bytes = Buffer.alloc(MAX_BYTES + 1); let size = 0;
    while (size < bytes.length) { const n = fs.readSync(fd, bytes, size, bytes.length - size, null); if (!n) break; size += n; }
    requireValue(size === opened.size && fs.fstatSync(fd).size === size && hash(bytes.subarray(0, size)) === expected.digest, 'ARTIFACT_INVALID');
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, size)));
    requireValue(validEvidence(value, expected), 'ARTIFACT_INVALID');
    return value;
  } catch { throw new Failure('ARTIFACT_INVALID'); }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}
export function validEvidence(v, expected) {
  const now = expected.now ?? Date.now();
  return exact(v, ['schemaVersion', 'kind', 'clientVersion', 'provenance', 'issuedAt', 'observationStartedAt', 'sourceExpiresAt', 'expiresAt', 'admissionId', 'samples', 'runIds', 'verdict'])
    && v.schemaVersion === 2 && v.kind === 'ci-evidence-v2' && v.clientVersion === VERSION
    && exact(v.provenance, ['provider', 'repository', 'sha', 'invocation', 'producerId', 'environment'])
    && Object.keys(v.provenance).every(k => v.provenance[k] === expected[k])
    && timestamp(v.issuedAt) && Date.parse(v.issuedAt) <= now && timestamp(v.observationStartedAt)
    && Date.parse(v.observationStartedAt) <= Date.parse(v.issuedAt) && timestamp(v.sourceExpiresAt) && Date.parse(v.sourceExpiresAt) > now
    && timestamp(v.expiresAt) && Date.parse(v.expiresAt) > now && Date.parse(v.expiresAt) <= Date.parse(v.sourceExpiresAt)
    && Date.parse(v.expiresAt) <= Date.parse(v.issuedAt) + 7 * 86400000
    && [1, 2].includes(v.samples) && Array.isArray(v.runIds) && v.runIds.length === v.samples
    && new Set(v.runIds).size === v.samples && v.runIds.every(id => typeof id === 'string' && /^[1-9][0-9]{0,18}$/.test(id) && BigInt(id) <= 9223372036854775807n)
    && validResponse('Verdict', v.verdict, { id: v.admissionId, samples: v.samples }) && v.verdict.outcome !== 'CONTROL_FAILED';
}
