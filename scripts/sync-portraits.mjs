import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanSounds } from './prepare-sounds.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const portraitSource = 'https://my.mpl.mobilelegends.com/?lang=en';

function decodeEntities(value) {
  return value.replace(/&#(?:0*39|x27);/gi, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

export function heroNameKey(value) {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
}

export function extractPortraits(html) {
  const portraits = new Map();
  const rows = html.matchAll(/<td\b[^>]*data-order="([^"]+)"[^>]*>([\s\S]*?)<\/td>/gi);
  for (const [, encodedName, contents] of rows) {
    const image = /<img\b[^>]*src="([^"]+)"/i.exec(contents);
    if (!image) continue;
    const name = decodeEntities(encodedName);
    let imageUrl = new URL(decodeEntities(image[1]));
    // The official page wraps its image-host URLs in this image proxy.
    if (imageUrl.hostname === 'wsrv.nl' && imageUrl.searchParams.has('url')) {
      imageUrl = new URL(imageUrl.searchParams.get('url'));
    }
    if (imageUrl.protocol !== 'https:') throw new Error(`Unexpected portrait URL for ${name}`);
    portraits.set(heroNameKey(name), { name, sourceUrl: imageUrl.href });
  }
  if (!portraits.size) throw new Error('No hero portraits found on the source page.');
  return portraits;
}

export function imageExtension(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'webp';
  throw new Error('Portrait response is not a PNG, JPEG, or WebP image.');
}

async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Portrait request returned HTTP ${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--source-html')) {
    throw new Error('Usage: node scripts/sync-portraits.mjs [--source-html path]');
  }
  const html = args.length ? await readFile(resolve(args[1]), 'utf8') : (await download(portraitSource)).toString('utf8');
  const available = extractPortraits(html);
  const { heroes } = await scanSounds(join(root, 'MLBB-sound'));
  const missing = heroes.filter((hero) => !available.has(heroNameKey(hero.name)));
  if (missing.length) throw new Error(`No source portrait for: ${missing.map((hero) => hero.name).join(', ')}`);
  const manifestPath = join(root, 'src', 'data', 'hero-portraits.json');
  const previous = JSON.parse(await readFile(manifestPath, 'utf8').catch(() => '{}'));
  const manifest = {};
  await mkdir(join(root, 'public', 'heroes'), { recursive: true });
  let index = 0;
  const failures = [];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (index < heroes.length) {
      const hero = heroes[index++];
      const source = available.get(heroNameKey(hero.name));
      try {
        const cached = previous[hero.id];
        if (cached?.sourceUrl === source.sourceUrl) {
          try { await access(join(root, 'public', cached.src)); manifest[hero.id] = { ...cached, name: hero.name }; continue; } catch { /* Download missing file. */ }
        }
        const bytes = await download(source.sourceUrl);
        const src = `heroes/${hero.id}.${imageExtension(bytes)}`;
        await writeFile(join(root, 'public', src), bytes);
        manifest[hero.id] = { name: hero.name, src, sourceUrl: source.sourceUrl };
      } catch (error) { failures.push(`${hero.name}: ${error.message}`); }
    }
  }));
  if (failures.length) throw new Error(failures.join('\n'));
  const ordered = Object.fromEntries(heroes.map((hero) => [hero.id, manifest[hero.id]]));
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(ordered, null, 2)}\n`);
  console.log(`Synced ${heroes.length} local hero portraits from ${portraitSource}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
