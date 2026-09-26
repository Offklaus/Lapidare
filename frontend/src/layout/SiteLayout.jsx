import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { Facet } from '../components/index.js';
import { useCustomer } from '../context/CustomerContext.jsx';
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
  const navigate = useNavigate();
  const { customer, logout } = useCustomer();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

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
          {/* O logo já leva ao início; o menu fica curto para caber no celular. */}
          <nav className="site-nav" aria-label="Principal">
            <NavLink to="/agendar" className="site-nav__link">
              Agendar
            </NavLink>
            {customer ? (
              <>
                <NavLink to="/minhas-reservas" className="site-nav__link">
                  <span className="nav-label--long">Minhas reservas</span>
                  <span className="nav-label--short">Reservas</span>
                </NavLink>
                <button type="button" className="site-nav__link site-nav__button" onClick={handleLogout}>
                  Sair
                </button>
              </>
            ) : (
              <>
                <NavLink to="/acompanhar" className="site-nav__link">
                  <span className="nav-label--long">Meu agendamento</span>
                  <span className="nav-label--short">Acompanhar</span>
                </NavLink>
                <NavLink to="/entrar" className="site-nav__link">
                  Entrar
                </NavLink>
              </>
            )}
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
            <Link to="/equipe">Área da equipe</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
