import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import { Facet } from '../components/index.js';
import useTheme from '../hooks/useTheme.js';

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={isDark ? 'Usar tema claro' : 'Usar tema escuro'}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        </svg>
      )}
    </button>
  );
}

export default function SiteLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="site">
      <header className="site-header">
        <div className="container site-header__inner">
          <Link to="/" className="brand" aria-label="Lapidare Beauty — início">
            <Facet size={28} />
            <span className="brand__name">
              <span className="brand__word">LAPIDARE</span>
              <span className="brand__sub">BEAUTY</span>
            </span>
          </Link>
          <nav className="site-nav" aria-label="Principal">
            <NavLink to="/" end className="site-nav__link">
              Início
            </NavLink>
            <NavLink to="/agendar" className="site-nav__link">
              Agendar
            </NavLink>
            <NavLink to="/acompanhar" className="site-nav__link">
              Meu agendamento
            </NavLink>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container">
          <div className="site-footer__rule" />
          <div className="site-footer__inner">
            <span className="t-caps">Lapidare Beauty</span>
            <span>Lapidamos sua beleza com naturalidade.</span>
            <a href="https://instagram.com/lapidare.beauty" target="_blank" rel="noreferrer">
              @lapidare.beauty
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
