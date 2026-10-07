import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Janela sobre a página (no celular, ocupa a tela toda). Esc fecha, o foco fica dentro dela e volta para
 * onde estava ao fechar. Clicar fora não fecha, para ninguém perder o que já preencheu.
 * footer: ações fixas no rodapé (ex.: o botão de confirmar).
 */
export default function Modal({ open, title, onClose, children, footer }) {
  const titleId = useId();
  const box = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const el = box.current;
    (el.querySelector('[data-autofocus]') || el).focus();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current?.();
      } else if (e.key === 'Tab') {
        const items = [...el.querySelectorAll(FOCUSABLE)];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="lp-modal__backdrop">
      <div className="lp-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={box} tabIndex={-1}>
        <header className="lp-modal__head">
          <h2 id={titleId} className="lp-modal__title">
            {title}
          </h2>
          <button type="button" className="lp-modal__close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>
        <div className="lp-modal__body">{children}</div>
        {footer ? <footer className="lp-modal__foot">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
