import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import GoogleSignInButton from '../components/GoogleSignInButton.jsx';
import { Facet } from '../components/index.js';
import { useCustomer } from '../context/CustomerContext.jsx';
import { USE_MOCK } from '../services/api.js';
import { getCustomerConfig, loginWithGoogle } from '../services/customerApi.js';
import useAsync from '../hooks/useAsync.js';
import { Loading } from './booking/steps/StepStatus.jsx';

/** Login da cliente (só com Google). A equipe entra pela Área da equipe, com e-mail e senha. */
export default function LoginPage() {
  const { customer, setCustomer } = useCustomer();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/minhas-reservas';
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const config = useAsync(() => (USE_MOCK ? Promise.resolve({ googleClientId: null }) : getCustomerConfig()), []);
  const clientId = config.data?.googleClientId;

  useEffect(() => {
    if (customer) navigate(redirectTo, { replace: true });
  }, [customer, navigate, redirectTo]);

  const handleCredential = async (credential) => {
    setSending(true);
    setError('');
    try {
      const data = await loginWithGoogle(credential);
      setCustomer(data.customer);
    } catch (err) {
      setError(err.message || 'Não conseguimos entrar agora. Tente de novo.');
      setSending(false);
    }
  };

  let body;
  if (USE_MOCK) {
    body = (
      <div className="notice notice--neutral">
        {import.meta.env.DEV ? (
          <>
            O login usa a API real. Em <code>frontend/.env</code>, defina <code>VITE_USE_MOCK=false</code>.
          </>
        ) : (
          'O login não está disponível nesta demonstração. Para ver um agendamento, use o código da confirmação.'
        )}
      </div>
    );
  } else if (config.loading) {
    body = <Loading>Carregando…</Loading>;
  } else if (!clientId) {
    body = (
      <div className="notice notice--neutral">
        O login com Google ainda não foi configurado no salão. Enquanto isso, acompanhe sua reserva pelo código.
      </div>
    );
  } else {
    body = (
      <>
        {sending ? <Loading>Entrando…</Loading> : <GoogleSignInButton clientId={clientId} onCredential={handleCredential} onError={setError} />}
        <p className="t-caption t-muted">Usamos só seu nome e e-mail do Google para encontrar suas reservas.</p>
      </>
    );
  }

  return (
    <div className="container account">
      <div className="account-login">
        <span className="account-login__brand">
          <Facet size={18} />
          <span className="t-caps">Minha conta</span>
        </span>
        <div className="account-login__head">
          <h1 className="t-display-l">Entre para acompanhar suas reservas</h1>
          <p className="t-body t-muted">
            Com sua conta Google você vê todos os seus agendamentos em um só lugar, sem precisar do código.
          </p>
        </div>

        <div className="account-login__action">
          {body}
          {error ? (
            <div className="notice notice--danger" role="alert">
              {error}
            </div>
          ) : null}
        </div>

        <div className="account-login__links t-body-sm">
          <Link to="/acompanhar">Tem o código? Acompanhe sem entrar</Link>
          <Link to="/equipe/entrar" className="t-muted">
            É da equipe? Área da equipe
          </Link>
        </div>
      </div>
    </div>
  );
}
