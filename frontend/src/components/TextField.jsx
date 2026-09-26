import { useId } from 'react';
import { cx } from '../lib/format.js';

/** Campo rotulado com ajuda e erro acessíveis. `error` substitui `hint`. */
export default function TextField({ label, hint, error, id, type = 'text', required, ...rest }) {
  const autoId = useId();
  const fieldId = id || autoId;
  const help = error || hint;

  return (
    <div className={cx('lp-field', error && 'lp-field--error')}>
      <label className="lp-field__label" htmlFor={fieldId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <input
        id={fieldId}
        type={type}
        className="lp-field__input"
        aria-invalid={error ? true : undefined}
        aria-describedby={help ? `${fieldId}-help` : undefined}
        required={required}
        {...rest}
      />
      {help ? (
        <p id={`${fieldId}-help`} className="lp-field__help">
          {error ? '⚠ ' : ''}
          {help}
        </p>
      ) : null}
    </div>
  );
}
