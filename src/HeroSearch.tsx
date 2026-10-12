import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, Ref } from 'react';
import type { Hero } from './game';
import HeroPortrait from './HeroPortrait';

interface Props {
  heroes: Hero[];
  value: string;
  onChange: (name: string) => void;
  disabled: boolean;
  inputRef: Ref<HTMLInputElement>;
}

export default function HeroSearch({ heroes, value, onChange, disabled, inputRef }: Props) {
  const listId = useId();
  const activeOption = useRef<HTMLLIElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const query = value.trim().toLowerCase();
  const matches = query ? heroes.filter((hero) => hero.name.toLowerCase().includes(query)) : heroes;
  const open = expanded && !disabled;
  const active = matches.find((hero) => hero.id === activeId);

  useEffect(() => {
    if (open && active && typeof activeOption.current?.scrollIntoView === 'function') {
      activeOption.current.scrollIntoView({ block: 'nearest' });
    }
  }, [open, active]);

  function choose(hero: Hero) {
    onChange(hero.name);
    setActiveId(null);
    field.current?.querySelector('input')?.focus();
    setExpanded(false);
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      if (open) event.preventDefault();
      setExpanded(false);
      setActiveId(null);
    } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && matches.length) {
      event.preventDefault();
      setExpanded(true);
      const index = matches.findIndex((hero) => hero.id === activeId);
      const next = event.key === 'ArrowDown' ? (index + 1) % matches.length : (index <= 0 ? matches.length - 1 : index - 1);
      setActiveId(matches[next].id);
    } else if (event.key === 'Enter' && open && active) {
      event.preventDefault();
      choose(active);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      setExpanded(false);
    }
  }

  return <div className="hero-search" ref={field} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) { setExpanded(false); setActiveId(null); }
  }}>
    <input ref={inputRef} id="hero-answer" type="text" role="combobox" aria-autocomplete="list"
      aria-expanded={open} aria-controls={open ? listId : undefined} aria-activedescendant={open && active ? `${listId}-${active.id}` : undefined}
      placeholder="Type a hero’s name…" autoComplete="off" spellCheck={false} value={value} disabled={disabled}
      onFocus={() => setExpanded(Boolean(query))} onClick={() => setExpanded(true)} onKeyDown={handleKey}
      onChange={(event) => { onChange(event.target.value); setExpanded(true); setActiveId(null); }} />
    {open ? <div className="hero-search-menu">
      <ul id={listId} role="listbox" aria-label="Hero suggestions" className="hero-search-options">
        {matches.map((hero) => <li key={hero.id} id={`${listId}-${hero.id}`} role="option" aria-selected={activeId === hero.id}
          ref={activeId === hero.id ? activeOption : undefined} tabIndex={-1} onClick={() => choose(hero)}
          onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveId(hero.id)}>
          <HeroPortrait hero={hero} /><span>{hero.name}</span>
        </li>)}
      </ul>
      {matches.length ? <p className="hero-search-help">{matches.length} {matches.length === 1 ? 'hero' : 'heroes'} · ↑ ↓ to browse · Enter to choose</p>
        : <p className="hero-search-empty" role="status">No heroes found. Try another name.</p>}
    </div> : null}
  </div>;
}
