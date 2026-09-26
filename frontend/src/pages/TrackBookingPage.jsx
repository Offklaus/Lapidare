import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Badge, BookingSummary, Button, TextField, BOOKING_STATUS } from '../components/index.js';
import { getBooking } from '../services/api.js';
import { formatBookingCode, formatDuration, formatShortDate } from '../lib/format.js';
import useAsync from '../hooks/useAsync.js';
import { Loading, LoadError } from './booking/steps/StepStatus.jsx';

const NOTES = {
  confirmed: 'Te esperamos! Se precisar remarcar ou cancelar, fale com a gente.',
  pending: 'Estamos confirmando seu horário. A confirmação chega pelo WhatsApp.',
  cancelled: 'Este agendamento foi cancelado. Se quiser, escolha um novo horário.',
  done: 'Atendimento realizado. Esperamos te ver de novo em breve.',
};

/** Agendamento ativo cuja hora já passou aparece como concluído. */
function displayStatus(booking) {
  if (booking.isPast && (booking.status === 'confirmed' || booking.status === 'pending')) return 'done';
  return booking.status;
}

function BookingResult({ lookup }) {
  if (lookup.loading) return <Loading>Buscando seu agendamento…</Loading>;

  if (lookup.error?.status === 404) {
    return (
      <div className="notice notice--neutral" role="alert">
        Não encontramos agendamento com esse código. Confira as letras e os números: o código aparece na tela de
        confirmação do agendamento.
      </div>
    );
  }
  if (lookup.error) return <LoadError error={lookup.error} onRetry={lookup.reload} />;

  const booking = lookup.data;
  const statusKey = displayStatus(booking);
  const status = BOOKING_STATUS[statusKey] || BOOKING_STATUS.confirmed;

  return (
    <section className="track__result" aria-live="polite">
      <p className="t-heading-sm">Olá, {booking.customerFirstName}!</p>
      <BookingSummary
        title={`Agendamento ${booking.code}`}
        items={[
          { label: 'Serviço', value: booking.service.name },
          { label: 'Profissional', value: booking.professional.name },
          { label: 'Data', value: formatShortDate(booking.date) },
          { label: 'Horário', value: booking.time },
          { label: 'Duração', value: formatDuration(booking.service.duration) },
        ]}
        total={booking.service.price}
        note={NOTES[statusKey]}
        action={<Badge tone={status.tone}>{status.label}</Badge>}
      />
    </section>
  );
}

export default function TrackBookingPage() {
  const { code: codeParam } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(formatBookingCode(codeParam || ''));
  const [inputError, setInputError] = useState('');

  useEffect(() => {
    setInput(formatBookingCode(codeParam || ''));
  }, [codeParam]);

  const lookup = useAsync(
    () => (codeParam ? getBooking(formatBookingCode(codeParam)) : Promise.resolve(null)),
    [codeParam],
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    const code = formatBookingCode(input);
    if (code.length !== 9) {
      setInputError('O código tem 8 letras e números, como K7QM-4XZP.');
      return;
    }
    setInputError('');
    if (code === formatBookingCode(codeParam || '')) lookup.reload();
    else navigate(`/acompanhar/${code}`);
  };

  return (
    <div className="container track">
      <header className="track__head">
        <span className="t-caps t-accent">Meu agendamento</span>
        <h1 className="t-display-l">Acompanhe seu horário</h1>
        <p className="t-body t-muted">Digite o código que aparece na confirmação do agendamento.</p>
      </header>

      <form className="track__form" onSubmit={handleSubmit} noValidate>
        <TextField
          label="Código do agendamento"
          placeholder="K7QM-4XZP"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={9}
          value={input}
          error={inputError}
          onChange={(e) => {
            setInput(formatBookingCode(e.target.value));
            setInputError('');
          }}
        />
        <Button type="submit">Buscar</Button>
      </form>

      {codeParam ? <BookingResult lookup={lookup} /> : null}
    </div>
  );
}
