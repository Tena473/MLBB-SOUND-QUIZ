import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import AudioPlayer from './AudioPlayer';
import { StrictMode } from 'react';
import heroData from './generated/heroes.json';
import portraitData from './data/hero-portraits.json';

const portraits: Record<string, { src: string }> = portraitData;

async function begin() {
  const user = userEvent.setup();
  render(<StrictMode><App /></StrictMode>);
  await user.click(screen.getByRole('button', { name: /Let’s play/ }));
  return user;
}

describe('the playable quiz', () => {
  it('shows the real roster and locks incomplete levels', () => {
    render(<App />);
    expect(screen.getByText(`${heroData.length} heroes to discover`)).toBeInTheDocument();
    for (const level of ['easy', 'mid', 'hard'] as const) {
      const count = heroData.filter((hero) => hero.sounds[level].length > 0).length;
      const unlocked = count >= (level === 'easy' ? 1 : 10);
      const button = screen.getByRole('button', { name: new RegExp(level, 'i') });
      if (unlocked) expect(button).toBeEnabled();
      else expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription(unlocked ? `${count} heroes available` : `${count} / 10 heroes ready`);
    }
  });
  it.each([false, true])('reveals the answer, blocks submission, counts once, and advances (played=%s)', async (played) => {
    const user = await begin();
    expect(document.querySelector('.answer-result')).not.toBeInTheDocument();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    if (played) await user.click(screen.getByRole('button', { name: 'Play sound' }));
    await user.click(screen.getByRole('button', { name: 'Show Answer' }));
    const result = screen.getByRole('status');
    const hero = result.querySelector('strong')?.textContent;
    expect(hero).toBeTruthy();
    const revealedHero = heroData.find((entry) => entry.name === hero)!;
    expect(result.closest('.answer-result')?.querySelector('img')).toHaveAttribute('src', `${import.meta.env.BASE_URL}${portraits[revealedHero.id].src}`);
    expect(result).toHaveTextContent('Counted as skipped');
    expect(screen.getByRole('button', { name: /Submit/ })).toBeDisabled();
    expect(screen.getByLabelText('Your guess')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Show Answer' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Round 2')).toBeInTheDocument();
    expect(document.querySelector('.answer-result')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Your guess')).toHaveFocus();
    expect(screen.getByLabelText('Your guess')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Show Answer' })).toBeEnabled();
    if (played) expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /End Game/ }));
    expect(screen.getByText('Accuracy across 1 scored round')).toBeInTheDocument();
    expect(screen.getByText('Skipped').previousSibling).toHaveTextContent('1');
  });
  it('supports exact answers via keyboard and rejects repeated submissions', async () => {
    const user = await begin();
    const audio = document.querySelector('audio')!;
    const folder = decodeURIComponent(audio.getAttribute('src')!).split('/').at(-2)!;
    const name = folder.replace(/^\d+ - /, '');
    await user.type(screen.getByLabelText('Your guess'), `  ${name.toUpperCase()}  `);
    await user.keyboard('{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('That’s right! +1 point');
    fireEvent.submit(document.querySelector('form')!);
    await user.click(screen.getByRole('button', { name: /End Game/ }));
    expect(screen.getByText('Correct').previousSibling).toHaveTextContent('1');
    expect(screen.getByText('Accuracy across 1 scored round')).toBeInTheDocument();
  });
  it('excludes an unavailable sound from scoring and resets for the next sound', async () => {
    const user = await begin();
    fireEvent.error(document.querySelector('audio')!);
    expect(screen.getByRole('alert')).toHaveTextContent('couldn’t load');
    expect(screen.getByRole('button', { name: /Submit/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Skip unavailable sound' }));
    expect(screen.getByRole('status')).toHaveTextContent('Not scored');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Your guess')).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /End Game/ }));
    expect(screen.getByText('Accuracy across 0 scored rounds')).toBeInTheDocument();
    expect(screen.getByText('1 unavailable sound excluded from your score.')).toBeInTheDocument();
  });
  it('handles ending before the first answer and starting a new session', async () => {
    const user = await begin();
    await user.click(screen.getByRole('button', { name: /End Game/ }));
    expect(screen.getByText('Accuracy across 0 scored rounds')).toBeInTheDocument();
    expect(screen.queryByText('NaN')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Play again/ }));
    expect(screen.getByText('Round 1')).toBeInTheDocument();
  });
  it('shows a portrait beside a matching name and fills the selected hero without submitting', async () => {
    const user = await begin();
    await user.type(screen.getByLabelText('Your guess'), 'chan');
    const option = screen.getByRole('option', { name: "Chang'e" });
    expect(option.querySelector('img')?.getAttribute('src')).toContain('heroes/025.');
    await user.click(option);
    expect(screen.getByLabelText('Your guess')).toHaveValue("Chang'e");
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit/ })).toBeEnabled();
  });
  it('opens all heroes by clicking the initially focused blank search field', async () => {
    const user = await begin();
    const input = screen.getByLabelText('Your guess');
    expect(input).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.click(input);
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(heroData.map((hero) => hero.name).sort((a, b) => a.localeCompare(b)));
    expect(screen.getAllByRole('option')).toHaveLength(heroData.length);
    expect(screen.getByRole('button', { name: /Submit/ })).toBeDisabled();
  });
  it('keeps the revealed name and Next usable if the answer portrait fails', async () => {
    const user = await begin();
    await user.click(screen.getByRole('button', { name: 'Show Answer' }));
    const result = screen.getByRole('status');
    const name = result.querySelector('strong')?.textContent;
    fireEvent.error(document.querySelector('.answer-result img')!);
    expect(document.querySelector('.answer-result img')).not.toBeInTheDocument();
    expect(document.querySelector('.answer-result .portrait-placeholder')).toBeInTheDocument();
    expect(result).toHaveTextContent(name!);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Round 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Your guess')).toHaveValue('');
  });
  it('closes search results and locks the search input after revealing an answer', async () => {
    const user = await begin();
    await user.type(screen.getByLabelText('Your guess'), 'a');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show Answer' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Your guess')).toBeDisabled();
  });
});

describe('audio controls', () => {
  it('keeps the audio source after Strict Mode replays effect cleanup', () => {
    render(<StrictMode><AudioPlayer sound="sounds/example.ogg" onErrorChange={() => {}} /></StrictMode>);
    expect(document.querySelector('audio')).toHaveAttribute('src', `${import.meta.env.BASE_URL}sounds/example.ogg`);
  });
  it('can retry a broken sound and replay after playback ends', async () => {
    const user = userEvent.setup();
    const onErrorChange = vi.fn();
    render(<AudioPlayer sound="sounds/example.ogg" onErrorChange={onErrorChange} />);
    const audio = document.querySelector('audio')!;
    fireEvent.error(audio);
    expect(onErrorChange).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByRole('button', { name: 'Retry sound' }));
    expect(onErrorChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.ended(audio);
    await user.click(screen.getByRole('button', { name: 'Replay sound' }));
    expect(audio.currentTime).toBe(0);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
  });
  it('handles playback rejection without leaving controls stuck', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(new DOMException('Unsupported audio', 'NotSupportedError'));
    const user = userEvent.setup();
    render(<AudioPlayer sound="sounds/example.ogg" onErrorChange={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Play sound' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry sound' })).toBeEnabled());
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
