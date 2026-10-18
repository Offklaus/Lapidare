import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button, Facet, TextField } from '../../components/index.js';
import { acceptStaffInvite, getStaffInvite } from '../../services/staffApi.js';
import useAsync from '../../hooks/useAsync.js';
import { Loading } from '../booking/steps/StepStatus.jsx';

const MIN = 10;

/**
 * Link de convite ou de redefinição de senha (vale 48 h, uma vez só). A pessoa cria a própria senha:
 * ninguém mais no salão fica sabendo qual é.
 */
export default function StaffInvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const invite = useAsync(() => getStaffInvite(token), [token]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null); // { needs2fa }

  const submit = async (event) => {
    event.preventDefault();
    if (password.length < MIN) return setError(`A senha precisa ter pelo menos ${MIN} caracteres.`);
    if (/^\d+$/.test(password)) return setError('Use letras também, não só números.');
    if (password !== confirm) return setError('As duas senhas não estão iguais.');
    setSending(true);
    setError('');
    try {
      const result = await acceptStaffInvite(token, password);
      setPassword('');
      setConfirm('');
      setDone(result);
      // O link já foi usado: tira ele do histórico do navegador.
      window.history.replaceState(null, '', '/equipe/entrar');
    } catch (err) {
      setError(err.message || 'Não conseguimos salvar a senha. Tente de novo.');
      setSending(false);
    }
    return undefined;
  };

  let content;
  if (invite.loading && !invite.data) content = <Loading>Conferindo o link…</Loading>;
  else if (invite.error) {
    content = (
      <div className="notice notice--danger" role="alert">
        {invite.error.message || 'Este link não vale mais.'}
      </div>
    );
  } else if (done) {
    content = (
      <>
        <div className="notice notice--success" role="status">
          Senha criada.{' '}
          {done.needs2fa
            ? 'No primeiro acesso você vai cadastrar o app autenticador (tenha o celular em mãos).'
            : 'Já pode entrar.'}
        </div>
        <Button block onClick={() => navigate('/equipe/entrar', { replace: true })}>
          Entrar na área da equipe
        </Button>
      </>
    );
  } else if (invite.data) {
    const { name, email, purpose, role } = invite.data;
    content = (
      <form onSubmit={submit} noValidate>
        <p className="t-body">
          Olá, <strong>{name}</strong>. {purpose === 'invite' ? 'Crie a senha da sua conta' : 'Crie uma senha nova'} (
          {email}, perfil {role === 'admin' ? 'admin' : 'profissional'}).
        </p>
        <TextField
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          hint={`Pelo menos ${MIN} caracteres. Uma frase curta é ótima: fácil de lembrar e difícil de adivinhar.`}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError('');
          }}
        />
        <TextField
          label="Repita a senha"
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
        <Button type="submit" block loading={sending}>
          Salvar senha
        </Button>
        <p className="t-caption t-muted">Não use a mesma senha de outros sites. Ninguém do salão vai pedir sua senha.</p>
      </form>
    );
  }

  return (
    <div className="staff-login">
      <div className="staff-login__card">
        <span className="staff-login__brand">
          <Facet size={20} />
          <span className="t-caps">Lapidare · Equipe</span>
        </span>
        <h1 className="t-display-l">Sua senha</h1>
        {content}
        <Link to="/" className="t-body-sm">
          Voltar ao site
        </Link>
      </div>
    </div>
  );
}
