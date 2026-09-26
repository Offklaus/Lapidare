import { ServiceCard } from '../../../components/index.js';
import { getServices } from '../../../services/api.js';
import useAsync from '../../../hooks/useAsync.js';
import { Loading, LoadError } from './StepStatus.jsx';

/** Etapa 2: serviços da profissional escolhida (todos, se for "Primeiro horário livre"), por categoria. */
export default function ServiceStep({ professionalId, selectedId, onSelect }) {
  const { data: services, loading, error, reload } = useAsync(() => getServices(professionalId), [professionalId]);

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

  return (
    <div className="booking__step">
      {categories.map((category) => (
        <div key={category} className="booking__block">
          <h2 className="t-heading">{category}</h2>
          <div className="card-grid" role="radiogroup" aria-label={category}>
            {services
              .filter((s) => s.category === category)
              .map((s) => (
                <ServiceCard
                  key={s.id}
                  name={s.name}
                  description={s.description}
                  duration={s.duration}
                  price={s.price}
                  selected={selectedId === s.id}
                  onSelect={() => onSelect(s)}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
