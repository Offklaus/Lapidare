import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';

import { Badge, BOOKING_STATUS } from '../components/index.js';
import { useCustomer } from '../context/CustomerContext.jsx';
import { getMyBookings } from '../services/customerApi.js';
import { formatDuration, formatPrice, formatShortDate } from '../lib/format.js';
import useAsync from '../hooks/useAsync.js';
import { Loading, LoadError } from './booking/steps/StepStatus.jsx';

const ACTIVE = ['pending', 'confirmed'];

/** Ativa com horário já passado aparece como concluída. */
const displayStatus = (b) => (b.isPast && ACTIVE.includes(b.status) ? 'done' : b.status);

function BookingCard({ booking }) {
  const status = BOOKING_STATUS[displayStatus(booking)] || BOOKING_STATUS.confirmed;
  return (
    <article className="my-booking">
      <div className="my-booking__when">
        <span className="my-booking__time">{booking.time}</span>
        <span className="t-body-sm t-muted">{formatShortDate(booking.date)}</span>
      </div>
      <div className="my-booking__main">
        <div className="my-booking__head">
          <span className="t-title">{booking.service.name}</span>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <span className="t-body-sm t-muted">
          {booking.professional.name} · {formatDuration(booking.service.duration)} · {formatPrice(booking.service.price)}
        </span>
        <span className="t-caption t-muted">Código {booking.code}</span>
      </div>
      <Link to={`/acompanhar/${booking.code}`} className="lp-btn lp-btn--sm lp-btn--secondary my-booking__link">
        {booking.cancellation.allowed ? 'Ver detalhes ou cancelar' : 'Ver detalhes'}
      </Link>
    </article>
  );
}

export default function MyBookingsPage() {
  const { customer, loading, setCustomer } = useCustomer();
  const list = useAsync(() => (customer ? getMyBookings() : Promise.resolve([])), [customer?.id]);

  // Sessão expirou no meio do caminho: volta a ser visitante (a página manda para o login).
  useEffect(() => {
    if (list.error?.status === 401) setCustomer(null);
  }, [list.error, setCustomer]);

  if (loading) return <div className="container account"><Loading>Carregando…</Loading></div>;
  if (!customer) return <Navigate to="/entrar" replace state={{ from: '/minhas-reservas' }} />;

  const bookings = list.data || [];
  const upcoming = bookings.filter((b) => !b.isPast && ACTIVE.includes(b.status)).reverse(); // mais próxima primeiro
  const history = bookings.filter((b) => !upcoming.includes(b));
  const firstName = customer.name.split(' ')[0];

  return (
    <div className="container account">
      <header className="account__head">
        <div>
          <span className="t-caps t-accent">Minhas reservas</span>
          <h1 className="t-display-l">Olá, {firstName}!</h1>
          <p className="t-body-sm t-muted">Reservas feitas com {customer.email}.</p>
        </div>
        <Link to="/agendar" className="lp-btn lp-btn--primary">
          Novo agendamento
        </Link>
      </header>

      {list.loading && !list.data ? <Loading>Buscando suas reservas…</Loading> : null}
      {list.error && list.error.status !== 401 ? <LoadError error={list.error} onRetry={list.reload} /> : null}

      {list.data && !bookings.length ? (
        <div className="empty-state">
          <p className="t-body">Você ainda não tem reservas com este e-mail.</p>
          <p className="t-body-sm t-muted">
            Agendou com outro e-mail? Acompanhe pelo <Link to="/acompanhar">código do agendamento</Link>.
          </p>
        </div>
      ) : null}

      {upcoming.length ? (
        <section className="account__section">
          <h2 className="t-heading">Próximas</h2>
          <div className="my-bookings">
            {upcoming.map((b) => (
              <BookingCard key={b.code} booking={b} />
            ))}
          </div>
        </section>
      ) : null}

      {history.length ? (
        <section className="account__section">
          <h2 className="t-heading">Anteriores e canceladas</h2>
          <div className="my-bookings">
            {history.map((b) => (
              <BookingCard key={b.code} booking={b} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
