import Choice from './Choice.jsx';
import { formatDuration, formatPrice } from '../lib/format.js';

/**
 * multiple: a cliente pode marcar vários serviços (feitos em sequência); `order` (1, 2…) mostra a posição
 * deste serviço na sequência.
 */
export default function ServiceCard({
  name,
  description,
  duration,
  price,
  category,
  selected,
  onSelect,
  multiple,
  order,
  disabled,
}) {
  return (
    <Choice selected={selected} onSelect={onSelect} multiple={multiple} disabled={disabled} className="lp-service">
      {order ? (
        <span className="lp-service__order" aria-label={`${order}º na sequência`}>
          {order}º
        </span>
      ) : null}
      {category ? <span className="lp-eyebrow">{category}</span> : null}
      <span className="lp-service__name">{name}</span>
      {description ? <span className="lp-service__desc">{description}</span> : null}
      <span className="lp-service__meta">
        <span>{formatDuration(duration)}</span>
        <span className="lp-service__price">{formatPrice(price)}</span>
      </span>
    </Choice>
  );
}
