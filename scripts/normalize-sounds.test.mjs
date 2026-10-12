// @vitest-environment node
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applySoundRenames, planSoundRenames } from './normalize-sounds.mjs';

describe('renaming source sounds', () => {
  let source;
  beforeEach(async () => { source = await mkdtemp(join(tmpdir(), 'hero-echo-renames-')); });
  afterEach(async () => {
    if (!source) return;
    if (!resolve(source).startsWith(join(resolve(tmpdir()), 'hero-echo-renames-'))) throw new Error('Unexpected cleanup path');
    await rm(source, { recursive: true, force: true });
  });
  async function add(folder, filename, contents = 'OggS audio bytes') {
    const directory = join(source, folder);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, filename), contents);
  }

  it('normalizes legacy names and Ogg .oga files while preserving every byte', async () => {
    await add('083 - Lukas', 'Audio1271-select.ogg', 'OggS Lukas');
    await add('116 - Terizla', 'Terizla.select.oga', 'OggS Terizla');
    const plan = await planSoundRenames(source);
    const originals = await Promise.all(plan.map(({ from }) => readFile(from)));
    expect(await applySoundRenames(plan)).toBe(2);
    expect(plan.map(({ to }) => to.split(/[\\/]/).at(-1))).toEqual(['Lukas-Easy-1.ogg', 'Terizla-Easy-1.ogg']);
    for (let index = 0; index < plan.length; index++) expect((await readFile(plan[index].to)).equals(originals[index])).toBe(true);
    expect(await applySoundRenames(await planSoundRenames(source))).toBe(0);
  });
  it('preserves Easy, Mid and Hard numbers and assigns unused Easy numbers to imports', async () => {
    await add('001 - Aamon', 'Aamon-Easy-1.ogg');
    await add('001 - Aamon', 'Audio-Easy-2.ogg');
    await add('001 - Aamon', 'Audio-Mid-2.ogg');
    await add('001 - Aamon', 'Audio-Hard-1.ogg');
    await add('001 - Aamon', 'Selection.ogg');
    await add('001 - Aamon', 'Movement.ogg');
    const plan = await planSoundRenames(source);
    await applySoundRenames(plan);
    expect((await readdir(join(source, '001 - Aamon'))).sort()).toEqual([
      'Aamon-Easy-1.ogg', 'Aamon-Easy-2.ogg', 'Aamon-Easy-3.ogg', 'Aamon-Easy-4.ogg', 'Aamon-Hard-1.ogg', 'Aamon-Mid-2.ogg',
    ]);
  });
  it('handles case-only names, spaces, apostrophes, and hyphenated heroes', async () => {
    await add('077 - Lapu-Lapu', 'Lapu-lapu-Easy-1.ogg');
    await add("025 - Chang'e", 'Voice.ogg');
    await add('085 - Luo Yi', 'Luoyi.select01.ogg');
    const plan = await planSoundRenames(source);
    expect(await applySoundRenames(plan)).toBe(3);
    for (const { to } of plan) expect((await readFile(to)).toString()).toBe('OggS audio bytes');
    expect(await readdir(join(source, '077 - Lapu-Lapu'))).toEqual(['Lapu-Lapu-Easy-1.ogg']);
  });
  it('refuses conflicting clip numbers before renaming any file', async () => {
    await add('012 - Aurora', 'Aurora-Easy-1.ogg', 'OggS first');
    await add('012 - Aurora', 'Audio-Easy-1.ogg', 'OggS second');
    await expect(planSoundRenames(source)).rejects.toThrow('Conflicting clips');
    expect((await readdir(join(source, '012 - Aurora'))).sort()).toEqual(['Audio-Easy-1.ogg', 'Aurora-Easy-1.ogg']);
  });
  it('refuses files that are not Ogg audio without changing their name', async () => {
    await add('116 - Terizla', 'Terizla.select.oga', 'not Ogg audio');
    await expect(planSoundRenames(source)).rejects.toThrow('Not an Ogg audio file');
    expect(await readdir(join(source, '116 - Terizla'))).toEqual(['Terizla.select.oga']);
  });
  it('does not overwrite a destination created after planning', async () => {
    await add('083 - Lukas', 'Selection.ogg', 'OggS original');
    const plan = await planSoundRenames(source);
    await add('083 - Lukas', 'Lukas-Easy-1.ogg', 'OggS new clip');
    await expect(applySoundRenames(plan)).rejects.toThrow('Destination already exists');
    expect((await readFile(join(source, '083 - Lukas', 'Selection.ogg'))).toString()).toBe('OggS original');
    expect((await readFile(join(source, '083 - Lukas', 'Lukas-Easy-1.ogg'))).toString()).toBe('OggS new clip');
  });
});
