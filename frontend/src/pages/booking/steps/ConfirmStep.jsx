import { Button } from '../../../components/index.js';

/** Etapa 5: revisão dos dados. No desktop o resumo com o botão fica na coluna direita;
    no mobile o resumo aparece aqui e o botão de confirmar fica na barra fixa. */
export default function ConfirmStep({ customer, error, onEdit, summary }) {
  return (
    <div className="booking__step">
      {error ? (
        <div className="notice notice--danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="booking__block">
        <h2 className="t-title">Seus dados</h2>
        <dl className="review-list">
          <div>
            <dt>Nome</dt>
            <dd>{customer.name}</dd>
          </div>
          <div>
            <dt>WhatsApp</dt>
            <dd>{customer.phone}</dd>
          </div>
          {customer.email ? (
            <div>
              <dt>E-mail</dt>
              <dd>{customer.email}</dd>
            </div>
          ) : null}
        </dl>
        <div>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Alterar dados
          </Button>
        </div>
      </div>

      <div className="only-mobile">{summary}</div>
    </div>
  );
}
