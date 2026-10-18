import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import { Button, TextField } from '../../components/index.js';
import { changeMyStaffPassword } from '../../services/staffApi.js';

/** Minha conta: dados de acesso, situação do 2FA e troca da própria senha (derruba os outros aparelhos). */
export default function StaffAccountPage() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setDone(false);
    if (next.length < 10) return setError('A nova senha precisa ter pelo menos 10 caracteres.');
    if (next !== confirm) return setError('As duas senhas novas não estão iguais.');
    setSaving(true);
    setError('');
    try {
      await changeMyStaffPassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
    } catch (err) {
      if (err.status === 401) navigate('/equipe/entrar', { replace: true });
      else setError(err.message || 'Não conseguimos trocar a senha.');
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <div className="container staff-page">
      <header className="staff-page__title">
        <span className="t-caps t-accent">Equipe</span>
        <h1 className="t-display-l">Minha conta</h1>
      </header>

      <dl className="staff-account">
        <div>
          <dt>Nome</dt>
          <dd>{user.name}</dd>
        </div>
        <div>
          <dt>E-mail</dt>
          <dd>{user.email}</dd>
        </div>
        <div>
          <dt>Perfil</dt>
          <dd>{user.role === 'admin' ? 'Admin: área da equipe inteira e usuários' : 'Profissional: a própria agenda'}</dd>
        </div>
        {user.role === 'admin' ? (
          <div>
            <dt>Verificação em duas etapas</dt>
            <dd>
              {user.twoFactor ? 'Ativa (app autenticador)' : 'Pendente'}. Perdeu o celular? Peça a outra admin para
              reiniciar em Usuários.
            </dd>
          </div>
        ) : null}
      </dl>

      <form className="staff-svc staff-account__form" onSubmit={submit} noValidate>
        <h2 className="t-heading-sm">Trocar senha</h2>
        <TextField
          label="Senha atual"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => {
            setCurrent(e.target.value);
            setError('');
          }}
        />
        <TextField
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          hint="Pelo menos 10 caracteres. Não use a mesma de outros sites."
          value={next}
          onChange={(e) => {
            setNext(e.target.value);
            setError('');
          }}
        />
        <TextField
          label="Repita a nova senha"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            setError('');
          }}
        />
        {error ? (
          <div className="notice notice--danger" role="alert">
            {error}
          </div>
        ) : null}
        {done ? (
          <div className="notice notice--success" role="status">
            Senha trocada. Os outros aparelhos em que você estava logada saíram.
          </div>
        ) : null}
        <div className="staff-svc__actions">
          <Button type="submit" size="sm" loading={saving}>
            Trocar senha
          </Button>
        </div>
      </form>
    </div>
  );
}
