// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractPortraits, heroNameKey, imageExtension } from './sync-portraits.mjs';

describe('portrait data and assets', () => {
  it('matches names with punctuation and unwraps the official page image proxy', () => {
    const rows = extractPortraits(`<td data-order="Chang&#039;e"><img src="https://wsrv.nl?url=https://ik.imagekit.io/example/Change.jpg"></td>
      <td data-order="Popol &amp; Kupa"><img src="https://ik.imagekit.io/example/Popol.jpg"></td>`);
    expect(rows.get(heroNameKey("Chang'e")).sourceUrl).toBe('https://ik.imagekit.io/example/Change.jpg');
    expect(rows.get(heroNameKey('Popol and Kupa')).name).toBe('Popol & Kupa');
    expect(heroNameKey('Lapu-Lapu')).toBe(heroNameKey('Lapu Lapu'));
  });
  it('rejects pages or downloaded files that do not contain portraits', () => {
    expect(() => extractPortraits('<html>Error</html>')).toThrow('No hero portraits found');
    expect(() => imageExtension(Buffer.from('<html>Error</html>'))).toThrow('not a PNG');
  });
  it('ships valid image bytes for every registered portrait and associates the correct hero name', async () => {
    const manifest = JSON.parse(await readFile('src/data/hero-portraits.json', 'utf8'));
    const heroes = JSON.parse(await readFile('src/generated/heroes.json', 'utf8'));
    expect(Object.keys(manifest).length).toBeGreaterThan(0);
    for (const hero of heroes) {
      const portrait = manifest[hero.id];
      if (!portrait) continue; // Future heroes without a synced portrait have a fallback.
      expect(portrait.name).toBe(hero.name);
      const bytes = await readFile(join('public', portrait.src));
      expect(portrait.src).toBe(`heroes/${hero.id}.${imageExtension(bytes)}`);
    }
  });
});
