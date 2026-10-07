import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import { Badge, Button, DateStrip, Toast, BOOKING_STATUS } from '../../components/index.js';
import { getProfessionals } from '../../services/api.js';
import {
  getFreeSlots,
  getStaffBookings,
  markConfirmationSent,
  markReminderSent,
  updateBookingStatus,
} from '../../services/staffApi.js';
import { ORIGIN_LABEL } from '../../lib/origins.js';
import NewBookingDialog from './NewBookingDialog.jsx';
import { confirmationMessage, reminderMessage, whatsappLink } from '../../lib/whatsapp.js';

/** Endereço do site para os links das mensagens (inclui a subpasta, se houver). */
const SITE_URL = window.location.origin + import.meta.env.BASE_URL;

/** 'YYYY-MM-DDTHH:MM' → "sáb, 26 de set às 14:34" */
const sentLabel = (stamp) => `${formatShortDate(stamp.slice(0, 10))} às ${stamp.slice(11, 16)}`;
import { addDaysISO, cx, formatDuration, formatPhone, formatShortDate, toISODate } from '../../lib/format.js';
import useAsync from '../../hooks/useAsync.js';
import { Loading, LoadError } from '../booking/steps/StepStatus.jsx';

function statusBadge(booking) {
  if (booking.status === 'cancelled') {
    return { tone: 'danger', label: booking.cancelledBy === 'customer' ? 'Cancelado pela cliente' : 'Cancelado pelo salão' };
  }
  return BOOKING_STATUS[booking.status] || BOOKING_STATUS.confirmed;
}

/** Um atendimento da agenda, com as ações que o servidor liberou (booking.actions). */
function BookingRow({ booking, showProfessional, cancelMinHours, onChanged, onSessionExpired }) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const { actions, customer } = booking;
  const badge = statusBadge(booking);

  const change = async (status) => {
    setBusy(status);
    setError('');
    try {
      onChanged(await updateBookingStatus(booking.id, status));
      setConfirmingCancel(false);
    } catch (err) {
      if (err.status === 401) onSessionExpired();
      else setError(err.message || 'Não conseguimos salvar. Tente de novo.');
    } finally {
      setBusy(null);
    }
  };

  const awaitingMark = actions.done && actions.noShow; // ainda ativo e o horário já começou

  // Confirmação: o link abre o WhatsApp do salão com o texto pronto; o clique registra o envio.
  const sentAt = booking.confirmationSentAt;
  const confirmHref = whatsappLink(
    customer.phone,
    confirmationMessage(booking, { siteUrl: SITE_URL, cancelMinHours }),
  );
  const reminderSentAt = booking.reminderSentAt;
  const reminderHref = whatsappLink(customer.phone, reminderMessage(booking, { siteUrl: SITE_URL }));

  const recordSent = (mark) => async () => {
    setError('');
    try {
      onChanged(await mark(booking.id));
    } catch (err) {
      if (err.status === 401) onSessionExpired();
      else setError(err.message || 'A mensagem abriu, mas não conseguimos registrar o envio. Tente de novo.');
    }
  };
  const markSent = recordSent(markConfirmationSent);
  const markReminder = recordSent(markReminderSent);

  return (
    <article className={cx('staff-booking', `is-${booking.status}`)}>
      <div className="staff-booking__time">
        <span className="staff-booking__start">{booking.time}</span>
        <span className="t-caption t-muted">até {booking.endTime}</span>
      </div>

      <div className="staff-booking__main">
        <div className="staff-booking__head">
          <span className="t-title">{customer.name}</span>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </div>
        <span className="t-body-sm">
          {booking.service.name} · {formatDuration(booking.service.duration)}
          {showProfessional ? ` · ${booking.professional.name}` : ''}
        </span>
        {booking.services?.length > 1 ? (
          <span className="t-caption t-muted staff-booking__sequence">
            {booking.services.map((s) => `${s.time} ${s.name}`).join(' · ')}
          </span>
        ) : null}
        <span className="staff-booking__contact t-body-sm">
          <a href={`https://wa.me/55${customer.phone}`} target="_blank" rel="noreferrer">
            WhatsApp {formatPhone(customer.phone)}
          </a>
          {customer.email ? <a href={`mailto:${customer.email}`}>{customer.email}</a> : null}
          <span className="t-muted">Código {booking.code}</span>
        </span>
        {booking.origin && booking.origin !== 'site' ? (
          <span className="t-caption t-muted">
            Marcado pela recepção · {ORIGIN_LABEL[booking.origin] || booking.origin}
            {booking.fitIn ? ' · encaixe' : ''}
          </span>
        ) : null}
        {booking.notes ? <span className="t-body-sm staff-booking__notes">Obs.: {booking.notes}</span> : null}
        {actions.sendConfirmation && sentAt ? (
          <span className="t-caption staff-booking__sent">Confirmação enviada {sentLabel(sentAt)}</span>
        ) : null}
        {actions.sendConfirmation && !sentAt ? (
          <span className="t-caption staff-booking__pending">Confirmação ainda não enviada</span>
        ) : null}
        {reminderSentAt ? (
          <span className="t-caption staff-booking__sent">Lembrete enviado {sentLabel(reminderSentAt)}</span>
        ) : null}
        {actions.sendReminder && !reminderSentAt ? (
          <span className="t-caption staff-booking__pending">
            Lembrete ainda não enviado ({booking.daysUntil === 0 ? 'o horário é hoje' : 'o horário é amanhã'})
          </span>
        ) : null}
        {awaitingMark ? (
          <span className="t-caption staff-booking__hint">O horário já começou: marque como concluído ou falta.</span>
        ) : null}
        {confirmingCancel ? (
          <span className="t-caption t-muted">A cliente não é avisada automaticamente: mande uma mensagem pelo WhatsApp.</span>
        ) : null}
        {error ? (
          <span className="t-caption staff-booking__error" role="alert">
            {error}
          </span>
        ) : null}
      </div>

      <div className="staff-booking__actions">
        {actions.sendReminder ? (
          <a
            className={cx('lp-btn lp-btn--sm', reminderSentAt ? 'lp-btn--ghost' : 'lp-btn--primary')}
            href={reminderHref}
            target="_blank"
            rel="noreferrer"
            onClick={markReminder}
          >
            {reminderSentAt ? 'Reenviar lembrete' : 'Enviar lembrete'}
          </a>
        ) : null}
        {actions.sendConfirmation ? (
          <a
            className={cx('lp-btn lp-btn--sm', sentAt ? 'lp-btn--ghost' : 'lp-btn--primary')}
            href={confirmHref}
            target="_blank"
            rel="noreferrer"
            onClick={markSent}
          >
            {sentAt ? 'Reenviar confirmação' : 'Enviar confirmação'}
          </a>
        ) : null}
        {actions.done ? (
          <Button size="sm" variant="secondary" loading={busy === 'done'} disabled={!!busy} onClick={() => change('done')}>
            {booking.status === 'no_show' ? 'Marcar concluído' : 'Concluído'}
          </Button>
        ) : null}
        {actions.noShow ? (
          <Button size="sm" variant="secondary" loading={busy === 'no_show'} disabled={!!busy} onClick={() => change('no_show')}>
            {booking.status === 'done' ? 'Marcar falta' : 'Faltou'}
          </Button>
        ) : null}
        {actions.cancel && !confirmingCancel ? (
          <Button size="sm" variant="danger" onClick={() => setConfirmingCancel(true)}>
            Cancelar
          </Button>
        ) : null}
        {actions.cancel && confirmingCancel ? (
          <>
            <Button size="sm" variant="danger" loading={busy === 'cancelled'} onClick={() => change('cancelled')}>
              Confirmar cancelamento
            </Button>
            <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => setConfirmingCancel(false)}>
              Voltar
            </Button>
          </>
        ) : null}
      </div>
    </article>
  );
}

export default function StaffAgendaPage() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const isAdmin = user.role === 'admin';
  const today = toISODate(new Date());

  const [view, setView] = useState('day');
  const [date, setDate] = useState(today);
  const [professionalId, setProfessionalId] = useState('all');
  const [updated, setUpdated] = useState({}); // id → agendamento que acabou de mudar
  const [newBooking, setNewBooking] = useState(null); // { key, initial } com o formulário aberto
  const [toast, setToast] = useState('');

  const to = view === 'day' ? date : addDaysISO(date, 6);
  const step = view === 'day' ? 1 : 7;

  const agenda = useAsync(
    () => getStaffBookings({ from: date, to, professionalId: isAdmin ? professionalId : undefined }),
    [date, to, professionalId, isAdmin],
  );
  const pros = useAsync(() => (isAdmin ? getProfessionals() : Promise.resolve([])), [isAdmin]);
  // Horários livres do dia (só admin, na visão Dia): clicar abre o agendamento já preenchido.
  const showFree = isAdmin && view === 'day' && date >= today;
  const freeSlots = useAsync(
    () => (showFree ? getFreeSlots({ date, professionalId }) : Promise.resolve(null)),
    [showFree, date, professionalId],
  );
  const openNewBooking = (initial) => setNewBooking({ key: Date.now(), initial: initial || { date: date >= today ? date : today } });

  // Lembretes pendentes de amanhã, para avisar mesmo com a agenda de hoje aberta.
  const tomorrow = addDaysISO(today, 1);
  const tomorrowAgenda = useAsync(
    () => getStaffBookings({ from: tomorrow, to: tomorrow, professionalId: isAdmin ? professionalId : undefined }),
    [tomorrow, professionalId, isAdmin],
  );

  // Faixa de dias (a mesma do agendamento): 7 dias antes a 20 depois da âncora, com a quantidade por dia.
  // A âncora só muda quando a data escolhida sai da faixa (‹ ›, Hoje), para a faixa não pular a cada clique.
  const [anchor, setAnchor] = useState(today);
  useEffect(() => {
    if (date < addDaysISO(anchor, -7) || date > addDaysISO(anchor, 20)) setAnchor(date);
  }, [date, anchor]);
  const stripFrom = addDaysISO(anchor, -7);
  const stripTo = addDaysISO(anchor, 20);
  const stripAgenda = useAsync(
    () => getStaffBookings({ from: stripFrom, to: stripTo, professionalId: isAdmin ? professionalId : undefined }),
    [stripFrom, stripTo, professionalId, isAdmin],
  );
  const stripDays = Array.from({ length: 28 }, (_, i) => ({ date: addDaysISO(stripFrom, i), available: true }));
  const stripCounts = {};
  for (const b of stripAgenda.data?.bookings || []) {
    if (b.status !== 'cancelled') stripCounts[b.date] = (stripCounts[b.date] || 0) + 1;
  }
  const remindersToSend = (tomorrowAgenda.data?.bookings || []).filter(
    (b) => b.actions.sendReminder && !b.reminderSentAt,
  ).length;
  const viewingTomorrow = view === 'day' && date === tomorrow;

  const sessionExpired = () => navigate('/equipe/entrar', { replace: true });

  useEffect(() => {
    if (agenda.error?.status === 401) sessionExpired();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agenda.error]);

  useEffect(() => setUpdated({}), [agenda.data]);

  const bookings = (agenda.data?.bookings || []).map((b) => updated[b.id] || b);
  const days = [...new Set(bookings.map((b) => b.date))];
  const count = (...statuses) => bookings.filter((b) => statuses.includes(b.status)).length;
  const showProfessional = isAdmin && professionalId === 'all';
  const cancelMinHours = agenda.data?.cancelMinHours ?? 24;
  const toConfirm = bookings.filter((b) => b.actions.sendConfirmation && !b.confirmationSentAt && !b.started).length;

  const title =
    view === 'day'
      ? `${date === today ? 'Hoje · ' : ''}${formatShortDate(date)}`
      : `${formatShortDate(date)} a ${formatShortDate(to)}`;

  return (
    <div className="container staff-page">
      <header className="staff-page__head">
        <div className="staff-page__title">
          <span className="t-caps t-accent">{isAdmin ? 'Agenda do salão' : 'Minha agenda'}</span>
          <h1 className="t-display-l">{title}</h1>
        </div>
        {isAdmin ? (
          <Button className="staff-new-booking" onClick={() => openNewBooking()}>
            Novo agendamento
          </Button>
        ) : null}

        <div className="staff-toolbar">
          <div className="staff-segment" role="group" aria-label="Período">
            <button type="button" aria-pressed={view === 'day'} onClick={() => setView('day')}>
              Dia
            </button>
            <button type="button" aria-pressed={view === 'week'} onClick={() => setView('week')}>
              Semana
            </button>
          </div>
          <div className="staff-nav">
            <Button variant="secondary" size="sm" onClick={() => setDate(addDaysISO(date, -step))} aria-label={view === 'day' ? 'Dia anterior' : 'Semana anterior'}>
              ‹
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDate(today)} disabled={date === today}>
              Hoje
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDate(addDaysISO(date, step))} aria-label={view === 'day' ? 'Próximo dia' : 'Próxima semana'}>
              ›
            </Button>
          </div>
          {isAdmin ? (
            <label className="staff-filter">
              <span className="t-label">Profissional</span>
              <select className="staff-select" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
                <option value="all">Todas</option>
                {(pros.data || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </header>

      <div className="staff-dates">
        <DateStrip
          days={stripDays}
          value={date}
          onChange={setDate}
          today={today}
          counts={stripAgenda.data ? stripCounts : undefined}
          label="Dia da agenda"
        />
      </div>

      <dl className="staff-counts" aria-label="Resumo do período">
        <div>
          <dt>A atender</dt>
          <dd>{count('pending', 'confirmed')}</dd>
        </div>
        <div>
          <dt>Concluídos</dt>
          <dd>{count('done')}</dd>
        </div>
        <div>
          <dt>Faltas</dt>
          <dd>{count('no_show')}</dd>
        </div>
        <div>
          <dt>Cancelados</dt>
          <dd>{count('cancelled')}</dd>
        </div>
      </dl>

      {remindersToSend ? (
        <div className="notice notice--warning staff-reminder-notice" role="status">
          <span>
            {remindersToSend === 1
              ? '1 cliente de amanhã ainda não recebeu o lembrete pelo WhatsApp.'
              : `${remindersToSend} clientes de amanhã ainda não receberam o lembrete pelo WhatsApp.`}
          </span>
          {!viewingTomorrow ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setView('day');
                setDate(tomorrow);
              }}
            >
              Ver agenda de amanhã
            </Button>
          ) : null}
        </div>
      ) : null}

      {toConfirm ? (
        <div className="notice notice--warning" role="status">
          {toConfirm === 1
            ? '1 cliente ainda não recebeu a confirmação pelo WhatsApp.'
            : `${toConfirm} clientes ainda não receberam a confirmação pelo WhatsApp.`}{' '}
          Use o botão “Enviar confirmação” em cada agendamento.
        </div>
      ) : null}

      {showFree && freeSlots.data ? (
        <section className="staff-free" aria-labelledby="staff-free-title">
          <h2 id="staff-free-title" className="t-label">
            Horários livres · toque para agendar
          </h2>
          {freeSlots.data.professionals.map((p) => (
            <div key={p.id} className="staff-free__pro">
              <span className="t-body-sm staff-free__name">{p.name}</span>
              {p.times.length ? (
                <div className="staff-free__times">
                  {p.times.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="lp-slot staff-free__slot"
                      onClick={() => openNewBooking({ professionalId: p.id, date, time: t })}
                      aria-label={`Agendar com ${p.name} às ${t}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="t-caption t-muted">Sem horários livres neste dia.</span>
              )}
            </div>
          ))}
        </section>
      ) : null}

      {agenda.loading && !agenda.data ? <Loading>Carregando agenda…</Loading> : null}
      {agenda.error && agenda.error.status !== 401 ? <LoadError error={agenda.error} onRetry={agenda.reload} /> : null}

      {agenda.data && !bookings.length ? (
        <div className="empty-state">
          <p className="t-body">Nenhum agendamento {view === 'day' ? 'neste dia' : 'nesta semana'}.</p>
        </div>
      ) : null}

      <div className={cx('staff-days', agenda.loading && 'is-loading')} aria-busy={agenda.loading || undefined}>
        {days.map((day) => {
          const list = bookings.filter((b) => b.date === day);
          return (
            <section key={day} className="staff-day" aria-label={formatShortDate(day)}>
              {view === 'week' ? (
                <h2 className="staff-day__title t-heading-sm">
                  {formatShortDate(day)} <span className="t-body-sm t-muted">{list.length} {list.length === 1 ? 'atendimento' : 'atendimentos'}</span>
                </h2>
              ) : null}
              <div className="staff-list">
                {list.map((b) => (
                  <BookingRow
                    key={b.id}
                    booking={b}
                    showProfessional={showProfessional}
                    cancelMinHours={cancelMinHours}
                    onChanged={(next) => {
                      setUpdated((prev) => ({ ...prev, [next.id]: next }));
                      tomorrowAgenda.reload(); // atualiza o aviso de lembretes pendentes
                      stripAgenda.reload(); // e a quantidade de atendimentos na faixa de dias
                    }}
                    onSessionExpired={sessionExpired}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {newBooking ? (
        <NewBookingDialog
          key={newBooking.key}
          initial={newBooking.initial}
          onClose={() => setNewBooking(null)}
          onSessionExpired={sessionExpired}
          onCreated={(created) => {
            setNewBooking(null);
            setToast(
              `Agendamento de ${created.client.name} marcado: ${formatShortDate(created.date)} às ${created.time}. Código ${created.code}.`,
            );
            if (created.date !== date) setDate(created.date);
            agenda.reload();
            stripAgenda.reload();
            tomorrowAgenda.reload();
            freeSlots.reload();
          }}
        />
      ) : null}
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  );
}
