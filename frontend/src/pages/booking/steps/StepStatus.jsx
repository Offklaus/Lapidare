import { Button } from '../../../components/index.js';

/** Estados de carregamento e erro compartilhados pelas etapas. */
export function Loading({ children = 'Carregando…' }) {
  return (
    <p className="loading" role="status">
      <span className="lp-spin" aria-hidden="true" />
      {children}
    </p>
  );
}

export function LoadError({ error, onRetry }) {
  return (
    <div className="notice notice--danger" role="alert">
      <div>
        <p>{error?.message || 'Não conseguimos carregar agora.'}</p>
        {onRetry ? (
          <Button variant="ghost" size="sm" onClick={onRetry}>
            Tentar de novo
          </Button>
        ) : null}
      </div>
    </div>
  );
}
