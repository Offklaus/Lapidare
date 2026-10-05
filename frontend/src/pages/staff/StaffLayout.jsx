import { useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { Button, Facet } from '../../components/index.js';
import { USE_MOCK } from '../../services/api.js';
import { getStaffMe, staffLogout } from '../../services/staffApi.js';
import useAsync from '../../hooks/useAsync.js';
import { Loading, LoadError } from '../booking/steps/StepStatus.jsx';

export function MockModeNotice() {
  return (
    <div className="notice notice--neutral">
      {/* Dica técnica só no computador de quem desenvolve; na demonstração publicada, texto para quem visita. */}
      {import.meta.env.DEV ? (
        <>
          O painel da equipe usa a API real. Em <code>frontend/.env</code>, defina <code>VITE_USE_MOCK=false</code> e
          reinicie o front.
        </>
      ) : (
        'O painel da equipe não está disponível nesta demonstração.'
      )}
    </div>
  );
}

/** Área da equipe: confere a sessão e mostra quem está logado. Sem sessão, vai para o login. */
export default function StaffLayout() {
  const navigate = useNavigate();
  const session = useAsync(() => (USE_MOCK ? Promise.resolve(null) : getStaffMe()), []);
  const user = session.data?.user;

  useEffect(() => {
    if (session.error?.status === 401) navigate('/equipe/entrar', { replace: true });
  }, [session.error, navigate]);

  const logout = async () => {
    try {
      await staffLogout();
    } finally {
      navigate('/equipe/entrar', { replace: true });
    }
  };

  let content;
  if (USE_MOCK) content = <div className="container staff-page"><MockModeNotice /></div>;
  else if (session.loading || session.error?.status === 401) content = <div className="container staff-page"><Loading>Carregando…</Loading></div>;
  else if (session.error) content = <div className="container staff-page"><LoadError error={session.error} onRetry={session.reload} /></div>;
  else content = <Outlet context={{ user }} />;

  return (
    <div className="site staff">
      <header className="site-header">
        <div className="container site-header__inner">
          <Link to="/equipe" className="brand" aria-label="Lapidare — área da equipe">
            <Facet size={28} />
            <span className="brand__name">
              <span className="brand__word">LAPIDARE</span>
              <span className="brand__sub">EQUIPE</span>
            </span>
          </Link>
          {user?.role === 'admin' ? (
            <nav className="site-nav staff-nav-links" aria-label="Área da equipe">
              <NavLink to="/equipe" end className="site-nav__link">
                Agenda
              </NavLink>
              <NavLink to="/equipe/profissionais" className="site-nav__link">
                Profissionais
              </NavLink>
              <NavLink to="/equipe/servicos" className="site-nav__link">
                Serviços
              </NavLink>
            </nav>
          ) : null}
          {user ? (
            <div className="staff-user">
              <span className="staff-user__who">
                <span>{user.name}</span>
                <span className="staff-user__role">{user.role === 'admin' ? 'Admin' : 'Profissional'}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={logout}>
                Sair
              </Button>
            </div>
          ) : null}
        </div>
      </header>
      <main className="site-main">{content}</main>
    </div>
  );
}
