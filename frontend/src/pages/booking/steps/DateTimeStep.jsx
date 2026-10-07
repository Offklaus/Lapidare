import { useEffect } from 'react';

import { Button, DateStrip, TimeSlotGrid } from '../../../components/index.js';
import { getAvailability, getSlots } from '../../../services/api.js';
import { formatDuration, formatShortDate, toISODate } from '../../../lib/format.js';
import { totalDuration } from '../../../lib/bookingServices.js';
import useAsync from '../../../hooks/useAsync.js';
import { Loading, LoadError } from './StepStatus.jsx';

/**
 * Etapa 3: faixa de dias (14 a partir de hoje) + grade de horários do dia escolhido.
 * Com vários serviços, os horários são de início da sequência inteira (cabe tudo, um depois do outro).
 */
export default function DateTimeStep({
  services,
  professionalId,
  date,
  time,
  slotsVersion,
  conflict,
  onSelectDate,
  onSelectTime,
}) {
  const serviceIds = services.map((s) => s.id);
  const key = serviceIds.join(',');
  const availability = useAsync(
    () => getAvailability({ serviceIds, professionalId, from: toISODate(new Date()), days: 14 }),
    [key, professionalId, slotsVersion],
  );

  const slots = useAsync(
    () => (date ? getSlots({ serviceIds, professionalId, date }) : Promise.resolve([])),
    [key, professionalId, date, slotsVersion],
  );

  const days = availability.data?.days || [];

  // Sem dia escolhido: seleciona o primeiro com horário livre.
  useEffect(() => {
    if (date || !days.length) return;
    const first = days.find((d) => d.available);
    if (first) onSelectDate(first.date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, date]);

  if (availability.loading && !days.length) return <Loading>Buscando dias disponíveis…</Loading>;
  if (availability.error) return <LoadError error={availability.error} onRetry={availability.reload} />;

  if (!days.some((d) => d.available)) {
    return (
      <div className="empty-state">
        <p className="t-body">Sem horários livres nas próximas duas semanas.</p>
        <p className="t-body-sm t-muted">Escolha outra profissional ou fale com a gente pelo Instagram.</p>
      </div>
    );
  }

  const nextFreeDay = days.find((d) => d.available && d.date > date);
  const hasFreeSlot = (slots.data || []).some((s) => s.status === 'available');

  return (
    <div className="booking__step">
      {conflict ? (
        <div className="notice notice--danger" role="alert">
          {conflict}
        </div>
      ) : null}

      <div className="booking__block">
        <h2 className="t-title">Dia</h2>
        <DateStrip days={days} value={date} onChange={onSelectDate} />
      </div>

      <div className="booking__block">
        <h2 className="t-title">{date ? `Horários de ${formatShortDate(date)}` : 'Horários'}</h2>
        {services.length > 1 ? (
          <p className="t-body-sm t-muted">
            Horário de início: os {services.length} serviços são feitos em sequência (
            {formatDuration(totalDuration(services))} no total).
          </p>
        ) : null}
        {slots.loading ? <Loading>Buscando horários…</Loading> : null}
        {slots.error ? <LoadError error={slots.error} onRetry={slots.reload} /> : null}
        {!slots.loading && !slots.error && hasFreeSlot ? (
          <TimeSlotGrid slots={slots.data} value={time} onChange={onSelectTime} />
        ) : null}
        {!slots.loading && !slots.error && date && !hasFreeSlot ? (
          <div className="empty-state">
            <p className="t-body">Sem horários neste dia.</p>
            {nextFreeDay ? (
              <Button variant="secondary" onClick={() => onSelectDate(nextFreeDay.date)}>
                Ver próximo dia livre
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
