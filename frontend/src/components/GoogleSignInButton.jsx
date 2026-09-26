/* Botão oficial "Fazer login com o Google" (Google Identity Services).
   Entrega um ID token para `onCredential`; quem confere o token é o servidor. */
import { useEffect, useRef } from 'react';

const SCRIPT_URL = 'https://accounts.google.com/gsi/client';
let loading = null;

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  loading ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => {
      loading = null;
      reject(new Error('Não conseguimos carregar o login do Google. Confira sua conexão e tente de novo.'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export default function GoogleSignInButton({ clientId, onCredential, onError }) {
  const container = useRef(null);
  const handler = useRef(onCredential);
  handler.current = onCredential;

  useEffect(() => {
    let alive = true;
    loadGoogleScript()
      .then(() => {
        if (!alive || !container.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => handler.current(response.credential),
          ux_mode: 'popup',
          auto_select: false,
        });
        window.google.accounts.id.renderButton(container.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          locale: 'pt-BR',
          width: 280,
        });
      })
      .catch((err) => alive && onError?.(err.message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  return <div ref={container} className="google-button" />;
}
