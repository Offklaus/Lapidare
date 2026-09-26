import Choice from './Choice.jsx';
import { formatDuration, formatPrice } from '../lib/format.js';

export default function ServiceCard({ name, description, duration, price, category, selected, onSelect }) {
  return (
    <Choice selected={selected} onSelect={onSelect} className="lp-service">
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
