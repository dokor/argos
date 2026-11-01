import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readBounded, writePrivate, hash, validEvidence } from './evidence.mjs';
import { exact } from './contracts.mjs';
import { fingerprint, FRESHNESS_MS } from './publication-policy.mjs';
import { Failure, requireValue } from './diagnostics.mjs';

// Authenticated encryption keeps public Actions artifacts opaque. No key is in an artifact/output/log.
const aad = (expected, config) => Buffer.from(fingerprint({ provenance: Object.fromEntries(
  ['provider', 'repository', 'sha', 'invocation', 'producerId', 'environment'].map(k => [k, expected[k]])),
  digest: expected.digest, policy: fingerprint(config) }));
export function sealProof(evidence, expected, config, key, path) {
  const bytes = Buffer.from(JSON.stringify(evidence) + '\n');
  requireValue(bytes.length <= 65536 && hash(bytes) === expected.digest && key.length === 32, 'ARTIFACT_INVALID');
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv); cipher.setAAD(aad(expected, config));
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return writePrivate(path, { version: 1, kind: 'argos-ci-encrypted-v1', iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'), tag: cipher.getAuthTag().toString('base64') }, 131072);
}
export function openProof(path, cipherDigest, expected, config, key, now = Date.now()) {
  try {
    const envelope = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(readBounded(path, cipherDigest, 131072)));
    requireValue(exact(envelope, ['version', 'kind', 'iv', 'ciphertext', 'tag']) && envelope.version === 1
      && envelope.kind === 'argos-ci-encrypted-v1' && key.length === 32, 'ARTIFACT_INVALID');
    const decode = (value, max) => { requireValue(typeof value === 'string' && /^[A-Za-z0-9+/]*={0,2}$/.test(value) && value.length <= max, 'ARTIFACT_INVALID');
      const bytes = Buffer.from(value, 'base64'); requireValue(bytes.toString('base64') === value, 'ARTIFACT_INVALID'); return bytes; };
    const iv = decode(envelope.iv, 16), tag = decode(envelope.tag, 24), ciphertext = decode(envelope.ciphertext, 87384);
    requireValue(iv.length === 12 && tag.length === 16 && ciphertext.length <= 65536, 'ARTIFACT_INVALID');
    const cipher = createDecipheriv('aes-256-gcm', key, iv); cipher.setAAD(aad(expected, config)); cipher.setAuthTag(tag);
    const bytes = Buffer.concat([cipher.update(ciphertext), cipher.final()]); requireValue(hash(bytes) === expected.digest, 'ARTIFACT_INVALID');
    const proof = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    requireValue(validEvidence(proof, { ...expected, now }) && now - Date.parse(proof.issuedAt) <= FRESHNESS_MS, 'ARTIFACT_INVALID'); return proof;
  } catch { throw new Failure('ARTIFACT_INVALID'); }
}
