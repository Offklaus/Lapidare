import { useEffect } from 'react';
import { cx } from '../lib/format.js';

/**
 * Aviso rápido no canto da tela (ex.: "Agendamento criado"). Some sozinho depois de `duration` ms.
 * A região fica sempre na página para leitores de tela anunciarem a mensagem quando ela aparece.
 * tone: 'success' | 'danger' | 'neutral'
 */
export default function Toast({ message, tone = 'success', onDone, duration = 6000 }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => onDone?.(), duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  return (
    <div className="lp-toast-region" role="status" aria-live="polite">
      {message ? (
        <div className={cx('lp-toast', `lp-toast--${tone}`)}>
          <span>{message}</span>
          <button type="button" className="lp-toast__close" onClick={onDone} aria-label="Fechar aviso">
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
