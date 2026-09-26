import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Badge, BookingSummary, Button, BOOKING_STATUS } from '../components/index.js';

export default function BookingSuccessPage() {
  const { state } = useLocation();
  const [copied, setCopied] = useState(false);

  if (!state?.booking) {
    return (
      <div className="container success">
        <h1 className="t-display-l">Nenhum agendamento por aqui</h1>
        <p className="t-body t-muted">Escolha o serviço e o horário para reservar, ou acompanhe um agendamento pelo código.</p>
        <div className="success__actions">
          <Link to="/agendar" className="lp-btn lp-btn--primary">
            Agendar horário
          </Link>
          <Link to="/acompanhar" className="lp-btn lp-btn--secondary">
            Acompanhar agendamento
          </Link>
        </div>
      </div>
    );
  }

  const { booking, items, total, customerName } = state;
  const status = BOOKING_STATUS[booking.status] || BOOKING_STATUS.confirmed;
  const firstName = customerName?.split(' ')[0];
  const code = booking.code;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* sem permissão de área de transferência: o código continua visível na tela */
    }
  };

  return (
    <div className="container success">
      <span className="t-caps t-accent">Agendamento feito</span>
      <h1 className="t-display-l">Prontinho{firstName ? `, ${firstName}` : ''}! Seu horário está reservado.</h1>
      <p className="t-body t-muted">Você vai receber a confirmação pelo WhatsApp.</p>

      {code ? (
        <div className="booking-code">
          <span className="t-label t-muted">Código do agendamento</span>
          <span className="booking-code__value">{code}</span>
          <Button variant="ghost" size="sm" onClick={copyCode} aria-live="polite">
            {copied ? 'Código copiado' : 'Copiar código'}
          </Button>
          <span className="t-caption t-muted">Guarde o código para acompanhar seu agendamento.</span>
        </div>
      ) : null}

      <div className="success__card">
        <BookingSummary items={items} total={total} action={<Badge tone={status.tone}>{status.label}</Badge>} />
      </div>

      <div className="success__actions">
        {code ? (
          <Link to={`/acompanhar/${code}`} className="lp-btn lp-btn--secondary">
            Acompanhar agendamento
          </Link>
        ) : null}
        <Link to="/" className="lp-btn lp-btn--ghost">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
