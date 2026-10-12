import { useCallback, useEffect, useRef, useState } from 'react';
import heroData from './generated/heroes.json';
import AudioPlayer from './AudioPlayer';
import HeroSearch from './HeroSearch';
import HeroPortrait from './HeroPortrait';
import { Icon } from './Icon';
import { accuracy, availableHeroes, DIFFICULTIES, isLevelUnlocked, nextRound, resolveRound, scoredTotal, startSession, submitAnswer } from './game';
import type { Difficulty, Hero, Session } from './game';

const heroes: Hero[] = heroData;
const names = [...heroes].sort((a, b) => a.name.localeCompare(b.name));
const levelInfo = {
  easy: { title: 'Easy', description: 'Familiar voices. A good place to start.', marker: '01' },
  mid: { title: 'Mid', description: 'A little less obvious. Listen closely.', marker: '02' },
  hard: { title: 'Hard', description: 'For those who know every voice.', marker: '03' },
};

export default function App() {
  const [screen, setScreen] = useState<'start' | 'game' | 'summary'>('start');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [session, setSession] = useState<Session | null>(null);
  const [answer, setAnswer] = useState('');
  const [audioError, setAudioError] = useState(false);
  const answerRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const handleAudioError = useCallback((value: boolean) => setAudioError(value), []);
  const number = session ? scoredTotal(session.stats) + session.stats.unavailable + (session.round.outcome ? 0 : 1) : 1;

  useEffect(() => {
    if (screen === 'game' && !session?.round.outcome) answerRef.current?.focus();
    else headingRef.current?.focus();
  }, [screen, number, session?.round.outcome]);

  function start() {
    setSession(startSession(heroes, difficulty));
    setAnswer('');
    setAudioError(false);
    setScreen('game');
  }

  function advance() {
    if (!session || !session.round.outcome) return;
    setSession(nextRound(session, heroes));
    setAnswer('');
    setAudioError(false);
  }

  function skip(revealed = false) {
    setSession((current) => current ? resolveRound(current, audioError ? 'unavailable' : 'skipped', revealed) : current);
  }

  const resolved = Boolean(session?.round.outcome);
  return (
    <div className="app-shell">
      <header className="site-header">
        <a href={import.meta.env.BASE_URL} className="brand" aria-label="Hero Echo home"><span className="brand-icon"><Icon name="sound" size={23} /></span><span>hero<span className="brand-light">echo</span><span className="brand-dot">.</span></span></a>
        <span className="header-tag">MLBB SOUND QUIZ</span>
        <div className="header-note"><span className="status-dot" /> Just listen & play</div>
      </header>
      <main>
        {screen === 'start' ? (
          <section className="welcome">
            <div className="eyebrow"><Icon name="headphones" size={17} /> A QUIZ FOR YOUR EARS</div>
            <h1 ref={headingRef} tabIndex={-1}>You know the heroes.<br />But do you know <span>their voices?</span></h1>
            <p className="intro">Listen to a voice line. Guess the MLBB hero.<br className="desktop-break" /> No timer, no pressure. Just you and the sound.</p>
            <div className="welcome-wave" aria-hidden="true">{Array.from({ length: 29 }, (_, index) => <span key={index} style={{ height: `${10 + ((index * 11 + index * index * 5) % 44)}px` }} />)}</div>
            <div className="level-section">
              <div className="section-label"><h2>Choose your difficulty</h2><span>{heroes.length} heroes to discover</span></div>
              <div className="level-grid" role="group" aria-label="Difficulty">
                {DIFFICULTIES.map((level) => {
                  const ready = isLevelUnlocked(heroes, level);
                  const count = availableHeroes(heroes, level).length;
                  const info = levelInfo[level];
                  return <button type="button" key={level} className={`level-card ${level === difficulty ? 'selected' : ''}`} disabled={!ready} aria-pressed={level === difficulty} aria-describedby={`level-${level}-availability`} onClick={() => setDifficulty(level)}>
                    <div className="level-top"><span className="level-number">{info.marker}</span>{ready ? <span className="selection-circle">{difficulty === level ? <Icon name="check" size={13} /> : null}</span> : <span className="coming-soon">Coming soon</span>}</div>
                    <h3>{info.title}</h3><p>{info.description}</p>
                    <div id={`level-${level}-availability`} className="level-count">{ready ? `${count} heroes available` : `${count} / 10 heroes ready`}</div>
                  </button>;
                })}
              </div>
              <button type="button" className="primary start-button" onClick={start} disabled={!isLevelUnlocked(heroes, difficulty)}>Let’s play <Icon name="arrow" size={19} /></button>
              <p className="start-note">Headphones recommended · Play as long as you like</p>
            </div>
            <div className="how-it-works"><span><b>01</b> Listen to the sound</span><span><b>02</b> Type a hero’s name</span><span><b>03</b> Reveal & keep going</span></div>
          </section>
        ) : null}
        {screen === 'game' && session ? (
          <section className="game-section">
            <div className="game-topline"><div><span className="difficulty-pill">{levelInfo[session.difficulty].title}</span><span className="round-label">Round {number}</span></div><button className="text-button" type="button" onClick={() => setScreen('summary')}>End Game <Icon name="close" size={15} /></button></div>
            <div className="game-heading"><span className="eyebrow">TRUST YOUR EARS</span><h1>Who’s that hero?</h1><p>Listen, take a guess, and see how well you know the roster.</p></div>
            <div className="game-card">
              <AudioPlayer key={number} sound={session.round.sound} onErrorChange={handleAudioError} />
              <form className="answer-form" onSubmit={(event) => { event.preventDefault(); if (!audioError) setSession((current) => current ? submitAnswer(current, answer) : current); }}>
                <label htmlFor="hero-answer">Your guess</label>
                <div className="answer-row"><HeroSearch key={number} heroes={names} value={answer} onChange={setAnswer} disabled={resolved || audioError} inputRef={answerRef} /><button className="primary" type="submit" disabled={resolved || audioError || !answer.trim()}>Submit <Icon name="arrow" size={17} /></button></div>
                {!resolved ? <p className="input-hint">Full hero name, please. Capital letters don’t matter.</p> : null}
              </form>
              {resolved ? <div className={`answer-result ${session.round.outcome === 'correct' ? 'correct' : ''}`}>
                <div className="answer-result-details"><HeroPortrait hero={session.round.hero} /><div role="status"><span className="result-label">{session.round.outcome === 'correct' ? 'That’s right! +1 point' : session.round.outcome === 'incorrect' ? 'Not quite. Now you know!' : session.round.outcome === 'unavailable' ? 'Sound unavailable · Not scored' : session.round.revealed ? 'Answer revealed · Counted as skipped' : 'Skipped · No points this round'}</span><strong>{session.round.hero.name}</strong></div></div>
                <button className="primary" type="button" onClick={advance} autoFocus>Next <Icon name="arrow" size={17} /></button>
              </div> : <div className="question-actions"><button type="button" className="secondary" onClick={() => skip(true)} disabled={audioError}><Icon name="eye" size={17} /> Show Answer</button><button type="button" className="text-button" onClick={() => skip()}>{audioError ? 'Skip unavailable sound' : 'Skip'} <Icon name="arrow" size={16} /></button></div>}
            </div>
            <div className="live-stats" aria-label="Current score"><div><strong>{session.stats.correct}</strong><span>Correct</span></div><div><strong>{session.stats.incorrect}</strong><span>Incorrect</span></div><div><strong>{session.stats.skipped}</strong><span>Skipped</span></div><div><strong>{accuracy(session.stats)}<small>%</small></strong><span>Accuracy</span></div></div>
            <p className="game-footnote">No rush. Replay the sound as many times as you need.</p>
          </section>
        ) : null}
        {screen === 'summary' && session ? (
          <section className="summary-section">
            <div className="summary-icon"><Icon name="headphones" size={32} /></div><span className="eyebrow">THAT’S A WRAP</span><h1 ref={headingRef} tabIndex={-1}>Nice listening.</h1><p className="intro">{scoredTotal(session.stats) ? 'Every voice is a little more familiar now.' : 'Your next hero is just a sound away.'}</p>
            <div className="summary-card"><span className="difficulty-pill">{levelInfo[session.difficulty].title}</span><div className="summary-score">{accuracy(session.stats)}<span>%</span></div><p>Accuracy across {scoredTotal(session.stats)} scored {scoredTotal(session.stats) === 1 ? 'round' : 'rounds'}</p><div className="summary-stats"><div><strong>{session.stats.correct}</strong><span>Correct</span></div><div><strong>{session.stats.incorrect}</strong><span>Incorrect</span></div><div><strong>{session.stats.skipped}</strong><span>Skipped</span></div></div>{session.stats.unavailable ? <p className="excluded-note">{session.stats.unavailable} unavailable {session.stats.unavailable === 1 ? 'sound' : 'sounds'} excluded from your score.</p> : null}</div>
            <button className="primary start-button" type="button" onClick={start}>Play again <Icon name="arrow" size={18} /></button><button className="text-button back-button" type="button" onClick={() => { setSession(null); setScreen('start'); }}>Choose difficulty</button>
          </section>
        ) : null}
      </main>
      <footer className="site-footer"><span>Made for the love of the game.</span><span>Unofficial fan quiz · Mobile Legends: Bang Bang</span></footer>
    </div>
  );
}
