import { cx } from '../lib/format.js';

/** Losango facetado: o motivo gráfico da marca (decorativo, aria-hidden). */
export default function Facet({ size = 16, className }) {
  return (
    <svg className={cx('lp-facet', className)} width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 1 15 8 8 15 1 8Z" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M1 8h14M8 1 5 8l3 7 3-7Z" fill="none" stroke="currentColor" strokeWidth=".75" />
    </svg>
  );
}
