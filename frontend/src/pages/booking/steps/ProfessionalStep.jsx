import { useEffect } from 'react';

import { ProfessionalCard } from '../../../components/index.js';
import { getProfessionals } from '../../../services/api.js';
import useAsync from '../../../hooks/useAsync.js';
import { ANY_PROFESSIONAL } from '../bookingReducer.js';
import { Loading, LoadError } from './StepStatus.jsx';

/** Etapa 1: "Primeiro horário livre" + todas as profissionais (o serviço vem depois). */
export default function ProfessionalStep({ selectedId, onSelect, onLoaded }) {
  const { data: professionals, loading, error, reload } = useAsync(() => getProfessionals(), []);

  useEffect(() => {
    if (professionals) onLoaded(professionals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionals]);

  if (loading) return <Loading>Carregando profissionais…</Loading>;
  if (error) return <LoadError error={error} onRetry={reload} />;

  return (
    <div className="card-list" role="radiogroup" aria-label="Profissional">
      <ProfessionalCard
        any
        name={ANY_PROFESSIONAL.name}
        role={ANY_PROFESSIONAL.role}
        selected={selectedId === ANY_PROFESSIONAL.id}
        onSelect={() => onSelect(ANY_PROFESSIONAL)}
      />
      {/* Quem ainda não tem nenhum serviço marcado no painel não aparece para a cliente. */}
      {professionals.filter((p) => p.specialties?.length).map((p) => (
        <ProfessionalCard
          key={p.id}
          name={p.name}
          role={p.role}
          specialties={p.specialties}
          photo={p.photo || undefined}
          selected={selectedId === p.id}
          onSelect={() => onSelect(p)}
        />
      ))}
    </div>
  );
}
