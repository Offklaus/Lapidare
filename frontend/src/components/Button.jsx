import { cx } from '../lib/format.js';

/**
 * variant: 'primary' (avançar) | 'action' (confirmar, uma por tela) | 'secondary' (voltar) | 'ghost' (link discreto)
 *          | 'danger' (ação destrutiva, ex.: cancelar agendamento)
 * size: 'sm' | 'md' | 'lg'
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  block,
  loading,
  disabled,
  type = 'button',
  className,
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      className={cx('lp-btn', `lp-btn--${variant}`, `lp-btn--${size}`, block && 'lp-btn--block', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="lp-spin" aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}
