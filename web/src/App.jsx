import { useEffect, useMemo, useRef, useState } from 'react';
import skills from './data/skills.json';

const CATEGORIES = ['all', ...new Set(skills.map((s) => s.category))];

const CATEGORY_LABELS = {
  all: 'All',
  engineering: 'Engineering',
  frontend: 'Frontend',
  productivity: 'Productivity',
  personal: 'Personal',
  misc: 'Misc',
  'in-progress': 'In progress',
};

function SkillCard({ skill, index }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef(null);

  function copy() {
    navigator.clipboard.writeText(skill.install).then(() => {
      setCopied(true);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 1600);
    });
  }

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  return (
    <article className="card" style={{ '--stagger': `${Math.min(index, 12) * 35}ms` }}>
      <div className="card__top">
        <span className={`card__tag card__tag--${skill.category}`}>
          {CATEGORY_LABELS[skill.category] ?? skill.category}
        </span>
      </div>
      <h2 className="card__name">{skill.name}</h2>
      <p className="card__description">{skill.description}</p>
      <button
        type="button"
        className={`card__install${copied ? ' is-copied' : ''}`}
        onClick={copy}
        title="Copy install command"
      >
        <span className="card__command">{skill.install}</span>
        <span className="card__copy">{copied ? 'Copied' : 'Copy'}</span>
      </button>
    </article>
  );
}

export default function App() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const inputRef = useRef(null);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setQuery('');
        inputRef.current?.blur();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter((s) => {
      if (category !== 'all' && s.category !== category) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
    });
  }, [query, category]);

  return (
    <div className="page">
      <header className="header">
        <a className="header__brand" href="https://github.com/creativoma/skills">
          creativoma<span className="header__slash">/</span>skills
        </a>
        <a className="header__github" href="https://github.com/creativoma/skills" aria-label="GitHub repository">
          <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
        </a>
      </header>

      <main className="main">
        <section className="hero">
          <h1 className="hero__title">
            Skills for <em>real</em> engineers
          </h1>
          <p className="hero__subtitle">
            {skills.length} agent skills for Claude Code. Search, copy, install.
          </p>
        </section>

        <div className="search">
          <svg className="search__icon" viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
            <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="m14 14 3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            className="search__input"
            type="search"
            placeholder="Search skills…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search skills"
          />
          <kbd className="search__kbd">/</kbd>
        </div>

        <div className="filters" role="tablist" aria-label="Filter by category">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={category === c}
              className={`filters__chip${category === c ? ' is-active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {CATEGORY_LABELS[c] ?? c}
              <span className="filters__count">
                {c === 'all' ? skills.length : skills.filter((s) => s.category === c).length}
              </span>
            </button>
          ))}
        </div>

        {filtered.length > 0 ? (
          <div className="grid" key={`${query}-${category}`}>
            {filtered.map((skill, i) => (
              <SkillCard key={skill.install} skill={skill} index={i} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <p className="empty__title">No skills match “{query}”</p>
            <p className="empty__hint">Try a different term, or clear the search with Esc.</p>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>
          MIT — skills by <a href="https://github.com/creativoma">Mariano Alvarez</a>, forked from{' '}
          <a href="https://github.com/mattpocock/skills">mattpocock/skills</a>
        </p>
      </footer>
    </div>
  );
}
