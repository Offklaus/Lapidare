import Facet from './Facet.jsx';
import { cx } from '../lib/format.js';

/** Cartão selecionável genérico (radio visual). Base de ServiceCard e ProfessionalCard. */
export default function Choice({ selected, onSelect, className, disabled, children }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={!!selected}
      disabled={disabled}
      onClick={onSelect}
      className={cx('lp-choice', selected && 'is-selected', className)}
    >
      {children}
      <span className="lp-choice__mark" aria-hidden="true">
        <Facet size={14} />
      </span>
    </button>
  );
}
