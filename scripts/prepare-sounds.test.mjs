// @vitest-environment node
import { readFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { scanSounds } from './prepare-sounds.mjs';

describe('sound discovery with a controlled library', () => {
  let fixtureRoot;
  let fixtureSource;
  beforeAll(async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), 'hero-echo-sounds-'));
    fixtureSource = join(fixtureRoot, 'valid');
    const folders = {
      '001 - Aamon': ['Aamon-Easy-1.ogg', 'Aamon-Easy-2.ogg', 'Aamon-Mid-1.ogg', 'Aamon-Hard-1.ogg'],
      "025 - Chang'e": ["Chang'e-Easy-1.ogg"],
      '012 - Aurora': ['Aurora-Easy-1.ogg'],
      '062 - Ixia': ['Ixia-Easy-1.ogg'],
      '077 - Lapu-Lapu': ['Lapu-Lapu-Easy-1.ogg'],
      '052 - Hanabi': [],
      '033 - Dori': ['Dori-Easy-1.ogg'],
    };
    for (const [folder, files] of Object.entries(folders)) {
      await mkdir(join(fixtureSource, folder), { recursive: true });
      for (const file of files) await writeFile(join(fixtureSource, folder, file), 'OggS fixture');
    }
  });
  afterAll(async () => {
    if (!fixtureRoot) return;
    const prefix = join(resolve(tmpdir()), 'hero-echo-sounds-');
    if (!resolve(fixtureRoot).startsWith(prefix)) throw new Error('Unexpected fixture cleanup path');
    await rm(fixtureRoot, { recursive: true, force: true });
  });

  it('excludes empty folders and Dori and groups multiple clips by level', async () => {
    const { heroes, copies } = await scanSounds(fixtureSource);
    expect(heroes).toHaveLength(5);
    expect(copies).toHaveLength(8);
    expect(heroes.find((hero) => hero.id === '033')).toBeUndefined();
    expect(heroes.find((hero) => hero.id === '052')).toBeUndefined();
    expect(heroes.reduce((sum, hero) => sum + hero.sounds.easy.length, 0)).toBe(6);
    expect(heroes.filter((hero) => hero.sounds.mid.length).map((hero) => hero.name)).toEqual(['Aamon']);
    expect(heroes[0].sounds.easy).toHaveLength(2);
    expect(heroes[0].sounds.mid).toHaveLength(1);
    expect(heroes[0].sounds.hard).toHaveLength(1);
  });
  it('uses the folder hero name and handles special URL characters', async () => {
    const { heroes } = await scanSounds(fixtureSource);
    const aurora = heroes.find((hero) => hero.name === 'Aurora');
    expect(aurora.sounds.easy[0]).toContain('Aurora-Easy-1.ogg');
    const change = heroes.find((hero) => hero.name === "Chang'e");
    expect(decodeURIComponent(change.sounds.easy[0])).toBe("sounds/025 - Chang'e/Chang'e-Easy-1.ogg");
    const ixia = heroes.find((hero) => hero.name === 'Ixia');
    expect(ixia.sounds.easy[0]).toContain('Ixia-Easy-1.ogg');
    expect(heroes.find((hero) => hero.name === 'Lapu-Lapu').sounds.easy[0]).toContain('Lapu-Lapu-Easy-1.ogg');
  });
  it('rejects malformed audio names with a clear error', async () => {
    const source = join(fixtureRoot, 'invalid');
    const folder = join(source, '001 - Aamon');
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, 'Aamon.ogg'), 'OggS fixture');
    await expect(scanSounds(source)).rejects.toThrow('Invalid sound name: 001 - Aamon/Aamon.ogg');
  });
  it('rejects filename prefixes that differ from the hero folder', async () => {
    const source = join(fixtureRoot, 'mismatched');
    const folder = join(source, '012 - Aurora');
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, 'Audio-Easy-1.ogg'), 'OggS fixture');
    await expect(scanSounds(source)).rejects.toThrow('Expected 012 - Aurora/Aurora-Easy-1.ogg');
  });
});

describe('actual sound library', () => {
  it('generates the current roster and registers every copied audio file', async () => {
    const { heroes, copies } = await scanSounds(resolve('MLBB-sound'));
    const generated = JSON.parse(await readFile(join('src', 'generated', 'heroes.json'), 'utf8'));
    expect(generated).toEqual(heroes);
    expect(heroes.length).toBeGreaterThan(0);
    expect(new Set(heroes.map((hero) => hero.id)).size).toBe(heroes.length);
    expect(heroes.some((hero) => hero.id === '033')).toBe(false);
    expect(heroes.every((hero) => Object.values(hero.sounds).some((sounds) => sounds.length))).toBe(true);
    expect(heroes.flatMap((hero) => Object.values(hero.sounds).flat())).toHaveLength(copies.length);
  });
  it('copies every registered sound intact and verifies the Ogg signature', async () => {
    const { heroes } = await scanSounds(resolve('MLBB-sound'));
    for (const hero of heroes) {
      for (const url of Object.values(hero.sounds).flat()) {
        const relative = decodeURIComponent(url).slice('sounds/'.length);
        const original = await readFile(join('MLBB-sound', relative));
        const copy = await readFile(join('public', 'sounds', relative));
        expect(copy.equals(original)).toBe(true);
        expect(copy.subarray(0, 4).toString()).toBe('OggS');
      }
    }
  });
});
