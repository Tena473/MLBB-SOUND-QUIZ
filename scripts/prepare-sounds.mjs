import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'MLBB-sound');
const output = join(root, 'public', 'sounds');
const generated = join(root, 'src', 'generated');
const levels = ['easy', 'mid', 'hard'];

// Read and validate everything before replacing generated files. Never modify source audio.
export async function scanSounds(sourceDirectory) {
  const heroes = [];
  const copies = [];
  const folders = (await readdir(sourceDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  for (const folder of folders) {
    if (folder.name === '033 - Dori') continue;
    const folderMatch = /^(\d+) - (.+)$/.exec(folder.name);
    if (!folderMatch) throw new Error(`Expected a hero folder like "001 - Aamon": ${folder.name}`);
    const sounds = { easy: [], mid: [], hard: [] };
    const files = (await readdir(join(sourceDirectory, folder.name), { withFileTypes: true }))
      .filter((entry) => entry.isFile() && /\.ogg$/i.test(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
    for (const file of files) {
      const match = /^(.+)-(Easy|Mid|Hard)-([1-9]\d*)\.ogg$/i.exec(file.name);
      if (!match) throw new Error(`Invalid sound name: ${folder.name}/${file.name}. Run npm run normalize:sounds.`);
      const level = match[2].toLowerCase();
      const levelName = level[0].toUpperCase() + level.slice(1);
      const expected = `${folderMatch[2]}-${levelName}-${match[3]}.ogg`;
      if (file.name !== expected) throw new Error(`Expected ${folder.name}/${expected}, received ${file.name}. Run npm run normalize:sounds.`);
      const relative = `sounds/${encodeURIComponent(folder.name)}/${encodeURIComponent(file.name)}`;
      sounds[level].push(relative);
      copies.push({ source: join(sourceDirectory, folder.name, file.name), folder: folder.name, file: file.name });
    }
    if (levels.some((level) => sounds[level].length)) {
      heroes.push({ id: folderMatch[1], name: folderMatch[2], sounds });
    }
  }
  if (!heroes.length) throw new Error('No valid .ogg sounds found in MLBB-sound.');
  return { heroes, copies };
}

async function prepare() {
  const { heroes, copies } = await scanSounds(source);
  // This is a fixed, script-owned generated directory inside this checkout.
  if (output !== join(root, 'public', 'sounds')) throw new Error('Unexpected output path');
  await rm(output, { recursive: true, force: true });
  await mkdir(generated, { recursive: true });
  for (const { source: fileSource, folder, file } of copies) {
    const targetDirectory = join(output, folder);
    await mkdir(targetDirectory, { recursive: true });
    await copyFile(fileSource, join(targetDirectory, file));
  }
  await writeFile(join(generated, 'heroes.json'), `${JSON.stringify(heroes, null, 2)}\n`);
  console.log(`Prepared ${copies.length} sounds for ${heroes.length} heroes.`);
  for (const level of levels) {
    const available = heroes.filter((hero) => hero.sounds[level].length);
    console.log(`${level}: ${available.length} heroes, ${available.reduce((sum, hero) => sum + hero.sounds[level].length, 0)} files`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepare().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
