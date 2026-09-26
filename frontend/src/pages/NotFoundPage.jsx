import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="container success">
      <span className="t-caps t-accent">Página não encontrada</span>
      <h1 className="t-display-l">Não achamos essa página</h1>
      <p className="t-body t-muted">O endereço pode ter mudado. Que tal começar pelo agendamento?</p>
      <Link to="/agendar" className="lp-btn lp-btn--primary">
        Agendar horário
      </Link>
    </div>
  );
}
