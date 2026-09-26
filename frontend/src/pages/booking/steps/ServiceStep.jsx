import { ServiceCard } from '../../../components/index.js';
import { getServices } from '../../../services/api.js';
import useAsync from '../../../hooks/useAsync.js';
import { Loading, LoadError } from './StepStatus.jsx';

/** Etapa 1: serviços agrupados por categoria. */
export default function ServiceStep({ selectedId, onSelect }) {
  const { data: services, loading, error, reload } = useAsync(getServices, []);

  if (loading) return <Loading>Carregando serviços…</Loading>;
  if (error) return <LoadError error={error} onRetry={reload} />;

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
