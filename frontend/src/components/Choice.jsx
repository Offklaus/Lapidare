import Facet from './Facet.jsx';
import { cx } from '../lib/format.js';

/**
 * Cartão selecionável genérico. Base de ServiceCard e ProfessionalCard.
 * Escolha única: radio (dentro de role="radiogroup"). multiple: caixa de marcar (dentro de role="group").
 */
export default function Choice({ selected, onSelect, className, disabled, multiple, children }) {
  return (
    <button
      type="button"
      role={multiple ? 'checkbox' : 'radio'}
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
