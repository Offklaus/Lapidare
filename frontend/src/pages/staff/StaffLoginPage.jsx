import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button, Facet, TextField } from '../../components/index.js';
import { USE_MOCK } from '../../services/api.js';
import { getStaffMe, staffLogin } from '../../services/staffApi.js';
import { MockModeNotice } from './StaffLayout.jsx';

export default function StaffLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  // Já tem sessão? Vai direto para a agenda.
  useEffect(() => {
    if (USE_MOCK) return;
    getStaffMe()
      .then(() => navigate('/equipe', { replace: true }))
      .catch(() => {});
  }, [navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Informe e-mail e senha.');
      return;
    }
    setSending(true);
    setError('');
    try {
      await staffLogin(email.trim(), password);
      navigate('/equipe', { replace: true });
    } catch (err) {
      setError(err.message || 'Não conseguimos entrar agora. Tente de novo.');
      setSending(false);
    }
  };

  return (
    <div className="staff-login">
      <div className="staff-login__card">
        <span className="staff-login__brand">
          <Facet size={20} />
          <span className="t-caps">Lapidare · Equipe</span>
        </span>
        <div>
          <h1 className="t-display-l">Área da equipe</h1>
          <p className="t-body t-muted">Entre para ver a agenda e registrar os atendimentos.</p>
        </div>

        {USE_MOCK ? (
          <MockModeNotice />
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <TextField
              label="E-mail"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
            />
            <TextField
              label="Senha"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
            />
            {error ? (
              <div className="notice notice--danger" role="alert">
                {error}
              </div>
            ) : null}
            <Button type="submit" block loading={sending}>
              Entrar
            </Button>
          </form>
        )}

        <Link to="/" className="t-body-sm">
          Voltar ao site
        </Link>
      </div>
    </div>
  );
}
