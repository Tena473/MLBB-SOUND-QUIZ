import { useState } from 'react';
import portraitData from './data/hero-portraits.json';
import type { Hero } from './game';

const portraits: Record<string, { name: string; src: string; sourceUrl: string }> = portraitData;

export default function HeroPortrait({ hero }: { hero: Pick<Hero, 'id' | 'name'> }) {
  const [failed, setFailed] = useState(false);
  const portrait = portraits[hero.id];
  const initials = hero.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('');
  return portrait?.name === hero.name && !failed ? (
    <img className="hero-portrait" src={`${import.meta.env.BASE_URL}${portrait.src}`} width="40" height="40" alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
  ) : <span className="hero-portrait portrait-placeholder" aria-hidden="true">{initials}</span>;
}
