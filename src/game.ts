export const DIFFICULTIES = ['easy', 'mid', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export interface Hero {
  id: string;
  name: string;
  sounds: Record<Difficulty, string[]>;
}
export type Outcome = 'correct' | 'incorrect' | 'skipped' | 'unavailable';
export interface Stats {
  correct: number;
  incorrect: number;
  skipped: number;
  unavailable: number;
}
export interface Session {
  difficulty: Difficulty;
  remaining: Hero[];
  round: { hero: Hero; sound: string; outcome: Outcome | null; revealed: boolean };
  stats: Stats;
}

export function availableHeroes(heroes: Hero[], difficulty: Difficulty): Hero[] {
  return heroes.filter((hero) => hero.sounds[difficulty].length > 0);
}

export function isLevelUnlocked(heroes: Hero[], difficulty: Difficulty): boolean {
  return availableHeroes(heroes, difficulty).length >= (difficulty === 'easy' ? 1 : 10);
}

export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function draw(pool: Hero[], remaining: Hero[], difficulty: Difficulty, previousId?: string, random = Math.random) {
  const deck = remaining.length ? [...remaining] : shuffle(pool, random);
  if (!remaining.length && deck.length > 1 && deck[0].id === previousId) {
    [deck[0], deck[1]] = [deck[1], deck[0]];
  }
  const hero = deck.shift();
  if (!hero) throw new Error('This level has no heroes with audio.');
  const sounds = hero.sounds[difficulty];
  return {
    remaining: deck,
    round: { hero, sound: sounds[Math.floor(random() * sounds.length)], outcome: null, revealed: false },
  };
}

export function startSession(heroes: Hero[], difficulty: Difficulty, random = Math.random): Session {
  if (!isLevelUnlocked(heroes, difficulty)) throw new Error('This difficulty is not ready yet.');
  return {
    difficulty,
    ...draw(availableHeroes(heroes, difficulty), [], difficulty, undefined, random),
    stats: { correct: 0, incorrect: 0, skipped: 0, unavailable: 0 },
  };
}

export function nextRound(session: Session, heroes: Hero[], random = Math.random): Session {
  if (!session.round.outcome) return session;
  return {
    ...session,
    ...draw(availableHeroes(heroes, session.difficulty), session.remaining, session.difficulty, session.round.hero.id, random),
  };
}

export function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveRound(session: Session, outcome: Outcome, revealed = false): Session {
  if (session.round.outcome) return session;
  return {
    ...session,
    round: { ...session.round, outcome, revealed },
    stats: { ...session.stats, [outcome]: session.stats[outcome] + 1 },
  };
}

export function submitAnswer(session: Session, answer: string): Session {
  if (!normalizeName(answer)) return session;
  return resolveRound(session, normalizeName(answer) === normalizeName(session.round.hero.name) ? 'correct' : 'incorrect');
}

export function scoredTotal(stats: Stats): number {
  return stats.correct + stats.incorrect + stats.skipped;
}

export function accuracy(stats: Stats): number {
  const total = scoredTotal(stats);
  return total ? Math.round((stats.correct / total) * 100) : 0;
}
