import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

export default function AudioPlayer({ sound, onErrorChange }: { sound: string; onErrorChange: (error: boolean) => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const operation = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState('');
  const [played, setPlayed] = useState(false);
  const [volume, setVolume] = useState(0.8);

  useEffect(() => {
    const audio = audioRef.current;
    // Strict Mode replays effects in development, including the cleanup below.
    // Restore the source on setup so that replay cannot leave the player empty.
    if (audio) audio.src = `${import.meta.env.BASE_URL}${sound}`;
    return () => {
      operation.current++;
      audio?.pause();
      audio?.removeAttribute('src');
      audio?.load();
    };
  }, [sound]);

  function markError() {
    setError(true);
    setPlaying(false);
    setBusy(false);
    onErrorChange(true);
  }

  async function play() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); return; }
    const attempt = ++operation.current;
    setNotice('');
    setBusy(true);
    if (error) {
      setError(false);
      onErrorChange(false);
      audio.load();
    }
    audio.volume = volume;
    audio.currentTime = 0;
    try {
      await audio.play();
      if (attempt === operation.current) { setPlayed(true); setBusy(false); }
    } catch (failure) {
      if (attempt !== operation.current) return;
      setBusy(false);
      if (failure instanceof DOMException && failure.name === 'AbortError') return;
      if (failure instanceof DOMException && failure.name === 'NotAllowedError') {
        setNotice('Your browser blocked playback. Press Play sound to try again.');
        return;
      }
      markError();
    }
  }

  return (
    <div className={`audio-panel ${playing ? 'is-playing' : ''}`}>
      <audio ref={audioRef} src={`${import.meta.env.BASE_URL}${sound}`} preload="metadata"
        onPlaying={() => { setPlaying(true); setBusy(false); }} onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)} onError={markError} />
      <div className="waveform" aria-hidden="true">
        {Array.from({ length: 37 }, (_, index) => <span key={index} style={{ height: `${12 + ((index * 17 + index * index * 3) % 53)}px`, animationDelay: `${index * 40}ms` }} />)}
      </div>
      <button type="button" className="listen-button" onClick={() => void play()} disabled={busy}>
        <Icon name={playing ? 'pause' : 'play'} size={19} />
        {busy ? 'Loading sound…' : playing ? 'Pause sound' : error ? 'Retry sound' : played ? 'Replay sound' : 'Play sound'}
      </button>
      <p className="audio-hint">{playing ? 'Listen closely. Who do you hear?' : 'One voice line. One hero. Take your time.'}</p>
      <div className="volume-control"><Icon name="sound" size={16} /><label htmlFor="volume">Volume</label><input id="volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => {
        const value = Number(event.target.value); setVolume(value); if (audioRef.current) audioRef.current.volume = value;
      }} /></div>
      {error ? <p role="alert" className="audio-error">This sound couldn’t load. Retry, or skip it without affecting your score.</p> : null}
      {notice ? <p role="status" className="audio-error">{notice}</p> : null}
    </div>
  );
}
