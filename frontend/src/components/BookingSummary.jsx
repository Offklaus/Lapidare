import Facet from './Facet.jsx';
import { formatPrice } from '../lib/format.js';

/** items: [{ label, value }] · total em reais · action: normalmente <Button variant="action" block> */
export default function BookingSummary({ title = 'Resumo do agendamento', items = [], total, note, action }) {
  return (
    <section className="lp-summary" aria-label={title}>
      <header className="lp-summary__head">
        <Facet size={18} />
        <h2 className="lp-summary__title">{title}</h2>
      </header>
      <dl className="lp-summary__list">
        {items.map((it) => (
          <div key={it.label} className="lp-summary__row">
            <dt>{it.label}</dt>
            <dd>{it.value}</dd>
          </div>
        ))}
      </dl>
      {total != null ? (
        <div className="lp-summary__total">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>
      ) : null}
      {note ? <p className="lp-summary__note">{note}</p> : null}
      {action || null}
    </section>
  );
}
