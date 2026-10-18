import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';

import { Button, Facet, TextField } from '../../components/index.js';
import { USE_MOCK } from '../../services/api.js';
import { getStaffMe, staffLogin, verifyStaff2fa } from '../../services/staffApi.js';
import { MockModeNotice } from './StaffLayout.jsx';

/** "JBSWY3DPEHPK3PXP" → "JBSW Y3DP EHPK 3PXP" (mais fácil de digitar no app). */
const groupSecret = (secret) => secret.replace(/(.{4})/g, '$1 ').trim();

/** Etapa do código do app autenticador (admin). enroll: primeiro acesso, cadastra o app pelo QR code. */
function TwoFactorStep({ step, onDone, onRestart }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [qr, setQr] = useState('');

  useEffect(() => {
    if (step.twoFactor !== 'enroll') return;
    // QR gerado aqui no navegador: o segredo não passa por nenhum serviço de fora.
    QRCode.toDataURL(step.otpauthUrl, { margin: 1, width: 220, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => setQr(''));
  }, [step]);

  const submit = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Digite os 6 números que aparecem no app.');
      return;
    }
    setSending(true);
    setError('');
    try {
      await verifyStaff2fa(step.challenge, code);
      onDone();
    } catch (err) {
      setCode('');
      setSending(false);
      // Etapa vencida ou erros demais: volta para a senha com a explicação.
      if (err.status === 401 && /de novo|expirou/i.test(err.message || '')) onRestart(err.message);
      else setError(err.message || 'Não conseguimos conferir o código. Tente de novo.');
    }
  };

  return (
    <form onSubmit={submit} noValidate className="staff-2fa">
      {step.twoFactor === 'enroll' ? (
        <>
          <div className="notice notice--neutral">
            <p className="t-body">
              <strong>Primeiro acesso de admin:</strong> proteja a conta com um app autenticador (Google
              Authenticator, Microsoft Authenticator, Authy ou o do seu gerenciador de senhas).
            </p>
          </div>
          <ol className="staff-2fa__steps t-body-sm">
            <li>No app, toque em adicionar e escaneie o QR code.</li>
            <li>Digite abaixo o código de 6 números que aparecer.</li>
          </ol>
          <div className="staff-2fa__qr">
            {qr ? <img src={qr} width="220" height="220" alt="QR code para cadastrar o app autenticador" /> : null}
            <div className="staff-2fa__secret">
              <span className="t-caption t-muted">Sem câmera? Digite a chave no app:</span>
              <code>{groupSecret(step.secret)}</code>
            </div>
          </div>
        </>
      ) : (
        <p className="t-body">Abra o app autenticador e digite o código de 6 números da Lapidare Beauty.</p>
      )}

      <TextField
        label="Código do app"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        value={code}
        onChange={(e) => {
          setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
          setError('');
        }}
      />
      {error ? (
        <div className="notice notice--danger" role="alert">
          {error}
        </div>
      ) : null}
      <Button type="submit" block loading={sending}>
        {step.twoFactor === 'enroll' ? 'Confirmar e entrar' : 'Entrar'}
      </Button>
      <Button variant="ghost" onClick={() => onRestart('')} disabled={sending}>
        Voltar para e-mail e senha
      </Button>
    </form>
  );
}

export default function StaffLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState(null); // { twoFactor, challenge, secret?, otpauthUrl? } depois da senha (admin)

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
      const result = await staffLogin(email.trim(), password);
      setPassword(''); // a senha não fica na memória da tela depois de usada
      if (result?.twoFactor) {
        setStep(result);
        setSending(false);
        return;
      }
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
          <h1 className="t-display-l">{step ? 'Verificação em duas etapas' : 'Área da equipe'}</h1>
          <p className="t-body t-muted">
            {step ? 'Mais uma camada de proteção para os dados das clientes.' : 'Acesso restrito à equipe do salão.'}
          </p>
        </div>

        {USE_MOCK ? <MockModeNotice /> : null}

        {!USE_MOCK && step ? (
          <TwoFactorStep
            step={step}
            onDone={() => navigate('/equipe', { replace: true })}
            onRestart={(message) => {
              setStep(null);
              setError(message);
            }}
          />
        ) : null}

        {!USE_MOCK && !step ? (
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
            <p className="t-caption t-muted">Esqueceu a senha? Peça a uma admin do salão um novo link de acesso.</p>
          </form>
        ) : null}

        <Link to="/" className="t-body-sm">
          Voltar ao site
        </Link>
      </div>
    </div>
  );
}
