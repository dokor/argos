import { constants, lstatSync, readFileSync, copyFileSync, openSync, writeFileSync, fsyncSync, closeSync, chmodSync, chownSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';

const override = '\n# Explicit production session operation: absolute and idle limits.\naccount.session-ttl = 24h\naccount.idle-ttl = 24h\n';
const namePattern = /^prod\.conf\.sessions-[0-9]+-[0-9]+-[a-f0-9]{16}\.bak$/;

function replace(path, text, metadata, suffix) {
  const temporary = path + '.' + suffix;
  const fd = openSync(temporary, 'wx', metadata.mode & 0o777);
  try { writeFileSync(fd, text); fsyncSync(fd); } finally { closeSync(fd); }
  try {
    chmodSync(temporary, metadata.mode & 0o777);
    if (process.platform !== 'win32') chownSync(temporary, metadata.uid, metadata.gid);
    renameSync(temporary, path);
    if (process.platform !== 'win32') {
      const dir = openSync(dirname(path), 'r');
      try { fsyncSync(dir); } finally { closeSync(dir); }
    }
  } catch (error) { try { unlinkSync(temporary); } catch {} throw error; }
}

/** Never return config text; private backups remain on the production host. */
export function sessionConfig(directory, backupName, operation) {
  if (!namePattern.test(backupName) || !['apply', 'restore'].includes(operation)) throw new Error('invalid-operation');
  const path = join(directory, 'prod.conf'), backup = join(directory, backupName);
  const metadata = lstatSync(path);
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('configuration-not-regular');
  if (operation === 'restore') {
    const saved = lstatSync(backup);
    if (!saved.isFile() || saved.isSymbolicLink()) throw new Error('backup-not-regular');
    replace(path, readFileSync(backup), metadata, backupName + '.restore');
    return { restored: true };
  }
  const current = readFileSync(path, 'utf8');
  if (current.endsWith(override)) return { changed: false };
  copyFileSync(path, backup, constants.COPYFILE_EXCL);
  chmodSync(backup, 0o600);
  const saved = openSync(backup, 'r+');
  try { fsyncSync(saved); } finally { closeSync(saved); }
  replace(path, current + override, metadata, backupName + '.next');
  return { changed: true, backupName };
}

if (process.argv[1] === '-') {
  try { console.log(JSON.stringify(sessionConfig('/ops', process.argv[3], process.argv[2]))); }
  catch { console.log(JSON.stringify({ error: 'configuration-operation-failed' })); process.exitCode = 1; }
}
