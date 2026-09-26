import { Link, useLocation } from 'react-router-dom';
import { Badge, BookingSummary, BOOKING_STATUS } from '../components/index.js';

export default function BookingSuccessPage() {
  const { state } = useLocation();

  if (!state?.booking) {
    return (
      <div className="container success">
        <h1 className="t-display-l">Nenhum agendamento por aqui</h1>
        <p className="t-body t-muted">Escolha o serviço e o horário para reservar.</p>
        <Link to="/agendar" className="lp-btn lp-btn--primary">
          Agendar horário
        </Link>
      </div>
    );
  }

  const { booking, items, total, customerName } = state;
  const status = BOOKING_STATUS[booking.status] || BOOKING_STATUS.confirmed;
  const firstName = customerName?.split(' ')[0];

  return (
    <div className="container success">
      <span className="t-caps t-accent">Agendamento feito</span>
      <h1 className="t-display-l">Prontinho{firstName ? `, ${firstName}` : ''}! Seu horário está reservado.</h1>
      <p className="t-body t-muted">Enviamos a confirmação para o seu WhatsApp.</p>
      <div className="success__card">
        <BookingSummary
          items={items}
          total={total}
          note={`Código do agendamento: ${booking.id}`}
          action={<Badge tone={status.tone}>{status.label}</Badge>}
        />
      </div>
      <Link to="/" className="lp-btn lp-btn--secondary">
        Voltar ao início
      </Link>
    </div>
  );
}
