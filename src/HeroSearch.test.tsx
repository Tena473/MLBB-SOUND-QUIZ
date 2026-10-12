import { createRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import HeroSearch from './HeroSearch';
import type { Hero } from './game';

const heroes: Hero[] = [
  { id: '001', name: 'Aamon', sounds: { easy: ['test.ogg'], mid: [], hard: [] } },
  { id: '002', name: 'Akai', sounds: { easy: ['test.ogg'], mid: [], hard: [] } },
  { id: '012', name: 'Aurora', sounds: { easy: ['test.ogg'], mid: [], hard: [] } },
  { id: '085', name: 'Luo Yi', sounds: { easy: ['test.ogg'], mid: [], hard: [] } },
];

function SearchForm({ onSubmit = () => {} }: { onSubmit?: () => void }) {
  const [value, setValue] = useState('');
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
    <label htmlFor="hero-answer">Your guess</label>
    <HeroSearch heroes={heroes} value={value} onChange={setValue} disabled={false} inputRef={createRef()} />
    <button type="submit">Submit</button>
  </form>;
}

describe('hero search suggestions', () => {
  it('opens the entire roster when clicking an empty, already focused field and reopens after Escape', async () => {
    const user = userEvent.setup();
    render(<SearchForm />);
    const input = screen.getByRole('combobox');
    await user.tab();
    expect(input).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.click(input);
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(heroes.map((hero) => hero.name));
    expect(screen.getAllByRole('option').every((option) => Boolean(option.querySelector('img')))).toBe(true);
    expect(input).toHaveValue('');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveFocus();
    await user.click(input);
    expect(screen.getAllByRole('option')).toHaveLength(heroes.length);
  });
  it('opens and selects with the keyboard before any text has been typed', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SearchForm onSubmit={onSubmit} />);
    await user.tab();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('option', { name: 'Luo Yi' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'Aamon' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('combobox')).toHaveValue('Aamon');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('closes an unfiltered roster when clicking outside or pressing Tab', async () => {
    const user = userEvent.setup();
    render(<><SearchForm /><button type="button">Outside</button></>);
    const input = screen.getByRole('combobox');
    await user.click(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.click(input);
    await user.tab();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveFocus();
  });
  it('filters names without case sensitivity and displays matching portraits', async () => {
    const user = userEvent.setup();
    render(<SearchForm />);
    await user.type(screen.getByRole('combobox'), '  AU');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    const option = screen.getByRole('option', { name: 'Aurora' });
    expect(option.querySelector('img')).toHaveAttribute('width', '40');
    expect(option.querySelector('img')?.getAttribute('src')).toContain('heroes/012.');
    await user.click(option);
    expect(screen.getByRole('combobox')).toHaveValue('Aurora');
    expect(screen.getByRole('combobox')).toHaveFocus();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });
  it('navigates by keyboard and selects without submitting the answer early', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SearchForm onSubmit={onSubmit} />);
    await user.type(screen.getByRole('combobox'), 'a');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    const option = screen.getByRole('option', { name: 'Akai' });
    expect(option).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-activedescendant', option.id);
    await user.keyboard('{Enter}');
    expect(screen.getByRole('combobox')).toHaveValue('Akai');
    expect(onSubmit).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
  it('closes with Escape and Tab, preserving the typed name', async () => {
    const user = userEvent.setup();
    render(<SearchForm />);
    await user.type(screen.getByRole('combobox'), 'a');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('a');
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('option', { name: 'Aurora' })).toHaveAttribute('aria-selected', 'true');
    await user.tab();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveFocus();
  });
  it('reports an empty search without selecting a different hero', async () => {
    const user = userEvent.setup();
    render(<SearchForm />);
    await user.type(screen.getByRole('combobox'), 'zzzz');
    expect(screen.getByRole('status')).toHaveTextContent('No heroes found');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    await user.clear(screen.getByRole('combobox'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(heroes.length);
  });
  it('falls back gracefully when a portrait fails while keeping the name selectable', async () => {
    const user = userEvent.setup();
    render(<SearchForm />);
    await user.type(screen.getByRole('combobox'), 'aur');
    const option = screen.getByRole('option', { name: 'Aurora' });
    fireEvent.error(option.querySelector('img')!);
    expect(option.querySelector('img')).not.toBeInTheDocument();
    await user.click(option);
    expect(screen.getByRole('combobox')).toHaveValue('Aurora');
  });
});
