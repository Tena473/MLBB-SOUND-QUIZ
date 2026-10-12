import { describe, expect, it } from 'vitest';
import { accuracy, availableHeroes, isLevelUnlocked, nextRound, resolveRound, scoredTotal, startSession, submitAnswer } from './game';
import type { Hero } from './game';

function pool(count: number): Hero[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${index}`, name: index === 0 ? "Chang'e" : `Hero ${index}`,
    sounds: { easy: [`${index}-easy.ogg`], mid: [`${index}-mid.ogg`], hard: [`${index}-hard.ogg`] },
  }));
}
const random = () => 0.999;

describe('difficulty availability', () => {
  it('counts distinct heroes rather than sound files', () => {
    const heroes = pool(1);
    heroes[0].sounds.mid = Array.from({ length: 20 }, (_, i) => `${i}.ogg`);
    expect(isLevelUnlocked(heroes, 'mid')).toBe(false);
    expect(isLevelUnlocked(heroes, 'easy')).toBe(true);
  });
  it.each(['mid', 'hard'] as const)('requires ten heroes for %s', (level) => {
    expect(isLevelUnlocked(pool(9), level)).toBe(false);
    expect(isLevelUnlocked(pool(10), level)).toBe(true);
    expect(() => startSession(pool(9), level)).toThrow('not ready');
  });
  it('excludes heroes without the selected audio', () => {
    const heroes = pool(2);
    heroes[0].sounds.easy = [];
    expect(availableHeroes(heroes, 'easy').map((hero) => hero.id)).toEqual(['1']);
    expect(isLevelUnlocked([], 'easy')).toBe(false);
  });
});

describe('continuous rounds', () => {
  it('uses every hero once per cycle and avoids a repeat at cycle boundaries', () => {
    const heroes = pool(6);
    let session = startSession(heroes, 'easy', () => 0);
    const ids: string[] = [];
    for (let i = 0; i < 30; i++) {
      ids.push(session.round.hero.id);
      session = nextRound(resolveRound(session, 'skipped'), heroes, () => 0);
    }
    for (let index = 0; index < ids.length; index += 6) expect(new Set(ids.slice(index, index + 6)).size).toBe(6);
    for (let index = 1; index < ids.length; index++) expect(ids[index]).not.toBe(ids[index - 1]);
  });
  it('handles a single available hero without failing', () => {
    const heroes = pool(1);
    const session = startSession(heroes, 'easy');
    expect(nextRound(resolveRound(session, 'skipped'), heroes).round.hero.id).toBe('0');
  });
  it('draws from multiple clips for the same hero', () => {
    const heroes = pool(1);
    heroes[0].sounds.easy.push('second.ogg');
    expect(startSession(heroes, 'easy', () => 0).round.sound).toBe('0-easy.ogg');
    expect(startSession(heroes, 'easy', random).round.sound).toBe('second.ogg');
  });
  it('cannot advance an unanswered question', () => {
    const heroes = pool(3);
    const session = startSession(heroes, 'easy');
    expect(nextRound(session, heroes)).toBe(session);
  });
});

describe('answers and scoring', () => {
  it('accepts case differences and surrounding spaces but not partial names', () => {
    const session = startSession(pool(1), 'easy', random);
    expect(submitAnswer(session, "  CHANG'E  ").stats.correct).toBe(1);
    expect(submitAnswer(session, 'Chang').stats.incorrect).toBe(1);
    expect(submitAnswer(session, '   ')).toBe(session);
  });
  it('reveal counts once as skipped and blocks subsequent answers', () => {
    const session = startSession(pool(1), 'easy');
    const revealed = resolveRound(session, 'skipped', true);
    expect(revealed.round.revealed).toBe(true);
    expect(revealed.stats).toEqual({ correct: 0, incorrect: 0, skipped: 1, unavailable: 0 });
    expect(resolveRound(revealed, 'skipped', true)).toBe(revealed);
    expect(submitAnswer(revealed, session.round.hero.name)).toBe(revealed);
  });
  it('empty and unavailable-only games have zero accuracy and no scored rounds', () => {
    const session = startSession(pool(1), 'easy');
    expect(accuracy(session.stats)).toBe(0);
    const excluded = resolveRound(session, 'unavailable');
    expect(scoredTotal(excluded.stats)).toBe(0);
    expect(accuracy(excluded.stats)).toBe(0);
  });
  it('includes skips in accuracy but excludes unavailable files', () => {
    expect(accuracy({ correct: 2, incorrect: 1, skipped: 1, unavailable: 10 })).toBe(50);
    expect(scoredTotal({ correct: 2, incorrect: 1, skipped: 1, unavailable: 10 })).toBe(4);
  });
});
