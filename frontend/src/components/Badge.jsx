/** Selo de status; sempre com a palavra, nunca só a cor. */
export default function Badge({ tone = 'neutral', children }) {
  return <span className={`lp-badge lp-badge--${tone}`}>{children}</span>;
}

/** Status do back-end → props do Badge. */
export const BOOKING_STATUS = {
  confirmed: { tone: 'success', label: 'Confirmado' },
  pending: { tone: 'warning', label: 'Pendente' },
  cancelled: { tone: 'danger', label: 'Cancelado' },
  done: { tone: 'neutral', label: 'Concluído' },
};
