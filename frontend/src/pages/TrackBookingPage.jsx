import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Badge, BookingSummary, Button, TextField, BOOKING_STATUS } from '../components/index.js';
import { cancelBooking, getBooking } from '../services/api.js';
import { formatBookingCode, formatDuration, formatShortDate } from '../lib/format.js';
import useAsync from '../hooks/useAsync.js';
import { Loading, LoadError } from './booking/steps/StepStatus.jsx';

const NOTES = {
  confirmed: 'Te esperamos!',
  pending: 'Estamos confirmando seu horário. A confirmação chega pelo WhatsApp.',
  cancelled: 'Este agendamento foi cancelado. Se quiser, escolha um novo horário.',
  done: 'Atendimento realizado. Esperamos te ver de novo em breve.',
  no_show: 'Não registramos sua presença neste horário. Quando quiser, é só agendar de novo.',
};

/** Agendamento ativo cuja hora já passou aparece como concluído. */
function displayStatus(booking) {
  if (booking.isPast && (booking.status === 'confirmed' || booking.status === 'pending')) return 'done';
  return booking.status;
}

/** Cancelar pelo código: pede os 4 últimos dígitos do WhatsApp para confirmar que é a cliente. */
function CancelBooking({ booking, onCancelled }) {
  const [open, setOpen] = useState(false);
  const [digits, setDigits] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const { allowed, deadline, minHours } = booking.cancellation;
  const deadlineText = `${formatShortDate(deadline.date)} às ${deadline.time}`;

  if (!allowed) {
    return (
      <div className="notice notice--neutral">
        Faltam menos de {minHours} h para o seu horário, então o cancelamento pelo site já encerrou. Para cancelar ou
        remarcar, fale com a gente.
      </div>
    );
  }

  const close = () => {
    setOpen(false);
    setDigits('');
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (digits.length !== 4) {
      setError('Digite os 4 últimos dígitos do WhatsApp usado no agendamento.');
      return;
    }
    setSending(true);
    setError('');
    try {
      await cancelBooking(booking.code, digits);
      onCancelled();
    } catch (err) {
      setError(err.message || 'Não conseguimos cancelar agora. Tente de novo em instantes.');
      setSending(false);
    }
  };

  if (!open) {
    return (
      <div className="track__cancel">
        <p className="t-body-sm t-muted">Não vai poder vir? Você pode cancelar pelo site até {deadlineText}.</p>
        <div>
          <Button variant="danger" onClick={() => setOpen(true)}>
            Cancelar agendamento
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="track__cancel track__cancel--open" onSubmit={handleSubmit} noValidate>
      <h2 className="t-title">Cancelar este agendamento?</h2>
      <p className="t-body-sm t-muted">
        Para confirmar que é você, digite os 4 últimos dígitos do WhatsApp usado no agendamento. O horário será liberado
        para outras clientes.
      </p>
      <TextField
        label="4 últimos dígitos do WhatsApp"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        maxLength={4}
        placeholder="0000"
        value={digits}
        error={error}
        onChange={(e) => {
          setDigits(e.target.value.replace(/\D/g, '').slice(0, 4));
          setError('');
        }}
      />
      <div className="track__cancel-actions">
        <Button variant="danger" type="submit" loading={sending}>
          Confirmar cancelamento
        </Button>
        <Button variant="ghost" onClick={close} disabled={sending}>
          Manter agendamento
        </Button>
      </div>
    </form>
  );
}

function BookingResult({ lookup, onCancelled }) {
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
  if (!lookup.data) return <Loading>Buscando seu agendamento…</Loading>;

  const booking = lookup.data;
  const statusKey = displayStatus(booking);
  const status = BOOKING_STATUS[statusKey] || BOOKING_STATUS.confirmed;
  const active = statusKey === 'confirmed' || statusKey === 'pending';

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
      {active && booking.cancellation ? <CancelBooking booking={booking} onCancelled={onCancelled} /> : null}
    </section>
  );
}

export default function TrackBookingPage() {
  const { code: codeParam } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(formatBookingCode(codeParam || ''));
  const [inputError, setInputError] = useState('');
  const [justCancelled, setJustCancelled] = useState(false);

  useEffect(() => {
    setInput(formatBookingCode(codeParam || ''));
    setJustCancelled(false);
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
    setJustCancelled(false);
    if (code === formatBookingCode(codeParam || '')) lookup.reload();
    else navigate(`/acompanhar/${code}`);
  };

  const handleCancelled = () => {
    setJustCancelled(true);
    lookup.reload();
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

      {justCancelled ? (
        <div className="notice notice--success" role="status">
          Agendamento cancelado. O horário foi liberado. Quando quiser, é só agendar de novo.
        </div>
      ) : null}

      {codeParam ? <BookingResult lookup={lookup} onCancelled={handleCancelled} /> : null}
    </div>
  );
}
