import { useEffect } from 'react';

import { ServiceCard } from '../../../components/index.js';
import { getProfessionals, getServices } from '../../../services/api.js';
import useAsync from '../../../hooks/useAsync.js';
import { formatDuration, formatPrice } from '../../../lib/format.js';
import { MAX_SERVICES, totalDuration, totalPrice } from '../../../lib/bookingServices.js';
import { Loading, LoadError } from './StepStatus.jsx';

/**
 * Etapa 2: serviços da profissional escolhida (todos, se for "Primeiro horário livre"), por categoria.
 * A cliente pode marcar mais de um: são feitos em sequência, na ordem em que ela marcou.
 */
export default function ServiceStep({ professionalId, selected, onToggle, onServicesOk }) {
  const { data: services, loading, error, reload } = useAsync(() => getServices(professionalId), [professionalId]);
  const ids = selected.map((s) => s.id);
  const key = ids.join(',');

  // "Primeiro horário livre" com 2 ou mais serviços: alguma profissional faz todos eles?
  const needsCheck = professionalId === 'any' && ids.length > 1;
  const combo = useAsync(() => (needsCheck ? getProfessionals(ids) : Promise.resolve(null)), [needsCheck, key]);
  const nobodyDoesAll = needsCheck && !combo.loading && Array.isArray(combo.data) && combo.data.length === 0;

  useEffect(() => {
    onServicesOk(!needsCheck || (!combo.loading && !nobodyDoesAll));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsCheck, combo.loading, nobodyDoesAll]);

  if (loading) return <Loading>Carregando serviços…</Loading>;
  if (error) return <LoadError error={error} onRetry={reload} />;
  if (!services?.length) {
    return (
      <div className="empty-state">
        <p className="t-body">Esta profissional ainda não tem serviços disponíveis para agendar.</p>
        <p className="t-body-sm t-muted">Volte e escolha outra profissional ou “Primeiro horário livre”.</p>
      </div>
    );
  }

  const categories = [...new Set(services.map((s) => s.category))];
  const full = ids.length >= MAX_SERVICES;

  return (
    <div className="booking__step">
      {categories.map((category) => (
        <div key={category} className="booking__block">
          <h2 className="t-heading">{category}</h2>
          <div className="card-grid" role="group" aria-label={category}>
            {services
              .filter((s) => s.category === category)
              .map((s) => {
                const position = ids.indexOf(s.id);
                return (
                  <ServiceCard
                    key={s.id}
                    multiple
                    name={s.name}
                    description={s.description}
                    duration={s.duration}
                    price={s.price}
                    selected={position >= 0}
                    order={ids.length > 1 && position >= 0 ? position + 1 : undefined}
                    disabled={full && position < 0}
                    onSelect={() => onToggle(s)}
                  />
                );
              })}
          </div>
        </div>
      ))}

      {selected.length > 1 ? (
        <div className="booking__sequence" role="status">
          <span className="t-label">Na sequência, com a mesma profissional</span>
          <ol>
            {selected.map((s) => (
              <li key={s.id}>
                {s.name} <span className="t-muted">· {formatDuration(s.duration)}</span>
              </li>
            ))}
          </ol>
          <span className="t-body-sm">
            Total: {formatDuration(totalDuration(selected))} · {formatPrice(totalPrice(selected))}
          </span>
        </div>
      ) : null}
      {full ? <p className="t-body-sm t-muted">Dá para escolher até {MAX_SERVICES} serviços por agendamento.</p> : null}
      {nobodyDoesAll ? (
        <div className="notice notice--warning" role="alert">
          Nenhuma profissional faz todos esses serviços no mesmo atendimento. Tire um deles ou agende-o separado.
        </div>
      ) : null}
    </div>
  );
}
