import { access, readFile, readdir, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const soundPattern = /^.+-(Easy|Mid|Hard)-([1-9]\d*)\.(ogg|oga)$/i;
const levelNames = { easy: 'Easy', mid: 'Mid', hard: 'Hard' };

// Return the complete mapping before touching any source files.
export async function planSoundRenames(sourceDirectory) {
  const source = resolve(sourceDirectory);
  const plan = [];
  const folders = (await readdir(source, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name !== '033 - Dori')
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  for (const folder of folders) {
    const match = /^(\d+) - (.+)$/.exec(folder.name);
    if (!match) throw new Error(`Expected a hero folder like "001 - Aamon": ${folder.name}`);
    const heroName = match[2];
    const directory = join(source, folder.name);
    const files = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && /\.(ogg|oga)$/i.test(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
    const used = { easy: new Set(), mid: new Set(), hard: new Set() };
    // Reserve all numbered clips so legacy imports cannot take their numbers.
    for (const file of files) {
      const parsed = soundPattern.exec(file.name);
      if (!parsed) continue;
      const level = parsed[1].toLowerCase();
      const number = Number(parsed[2]);
      if (!Number.isSafeInteger(number)) throw new Error(`Invalid clip number: ${folder.name}/${file.name}`);
      if (used[level].has(number)) throw new Error(`Conflicting clips for ${heroName}-${levelNames[level]}-${number}.ogg. No files were renamed.`);
      used[level].add(number);
    }
    for (const file of files) {
      const from = join(directory, file.name);
      const contents = await readFile(from);
      if (contents.subarray(0, 4).toString() !== 'OggS') {
        throw new Error(`Not an Ogg audio file: ${folder.name}/${file.name}. No files were renamed.`);
      }
      const parsed = soundPattern.exec(file.name);
      const level = parsed ? parsed[1].toLowerCase() : 'easy';
      let number = parsed ? Number(parsed[2]) : 1;
      if (!parsed) {
        while (used[level].has(number)) number++;
        used[level].add(number);
      }
      const filename = `${heroName}-${levelNames[level]}-${number}.ogg`;
      const to = join(directory, filename);
      if (dirname(from) !== directory || dirname(to) !== directory) throw new Error('Unexpected rename path');
      plan.push({ from, to });
    }
  }
  return plan;
}

export async function applySoundRenames(plan) {
  const changes = plan.filter(({ from, to }) => from !== to);
  const destinations = new Set();
  for (const { from, to } of changes) {
    if (dirname(from) !== dirname(to)) throw new Error('Renames must stay in their hero folder');
    if (destinations.has(to.toLowerCase())) throw new Error(`Duplicate rename destination: ${to}`);
    destinations.add(to.toLowerCase());
    if (from.toLowerCase() === to.toLowerCase()) continue; // Case-only Windows rename.
    try {
      await access(to);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    throw new Error(`Destination already exists: ${to}. No files were renamed.`);
  }
  const staged = changes.map((change) => ({ ...change, temporary: join(dirname(change.from), `.hero-echo-${randomUUID()}.tmp`), location: 'source' }));
  try {
    // Two phases also handle filename changes that differ only in letter case.
    for (const entry of staged) { await rename(entry.from, entry.temporary); entry.location = 'temporary'; }
    for (const entry of staged) { await rename(entry.temporary, entry.to); entry.location = 'destination'; }
  } catch (error) {
    const failures = [error];
    for (const entry of staged) {
      if (entry.location !== 'destination') continue;
      try { await rename(entry.to, entry.temporary); entry.location = 'temporary'; } catch (failure) { failures.push(failure); }
    }
    for (const entry of staged) {
      if (entry.location !== 'temporary') continue;
      try { await rename(entry.temporary, entry.from); } catch (failure) { failures.push(failure); }
    }
    throw new AggregateError(failures, 'Sound renaming failed. Original names were restored where possible.');
  }
  return changes.length;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--apply')) throw new Error('Usage: node scripts/normalize-sounds.mjs [--apply]');
  const plan = await planSoundRenames(join(root, 'MLBB-sound'));
  const changes = plan.filter(({ from, to }) => from !== to);
  if (args.includes('--apply')) {
    const count = await applySoundRenames(plan);
    console.log(`Renamed ${count} of ${plan.length} sounds. Audio contents and hero folders were preserved.`);
  } else {
    for (const { from, to } of changes) console.log(`${from.slice(root.length + 1)} -> ${to.slice(root.length + 1)}`);
    console.log(`${changes.length} of ${plan.length} sounds need renaming. Run npm run normalize:sounds to apply.`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
