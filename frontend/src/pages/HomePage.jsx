import { Link } from 'react-router-dom';
import { Facet } from '../components/index.js';

const CATEGORIES = [
  { name: 'Unhas', text: 'Manicure, pedicure e esmaltação em gel.' },
  { name: 'Alongamento', text: 'Alongamento em gel e manutenção.' },
  { name: 'Sobrancelhas', text: 'Design e brow lamination.' },
  { name: 'Cílios', text: 'Lash lifting e extensão fio a fio.' },
  { name: 'Nanopigmentação', text: 'Fios desenhados, resultado natural.' },
  { name: 'Laser', text: 'Depilação a laser por região.' },
];

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <span className="t-caps hero__eyebrow">Lapidare Beauty</span>
          <h1 className="t-display-xl">Lapidamos sua beleza com naturalidade</h1>
          <p className="t-body hero__lead">
            Unhas, alongamento, sobrancelhas, cílios, nanopigmentação e laser. Escolha a profissional, o
            serviço e o horário em poucos passos.
          </p>
          <Link to="/agendar" className="lp-btn lp-btn--primary lp-btn--lg">
            Agendar horário
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section__head">
            <Facet size={18} />
            <h2 className="t-heading">Nossos serviços</h2>
          </div>
          <div className="category-grid">
            {CATEGORIES.map((c) => (
              <article key={c.name} className="category-card">
                <span className="lp-eyebrow">{c.name}</span>
                <p className="t-body-sm t-muted">{c.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="divider" aria-hidden="true">
            <Facet size={16} />
          </div>
        </div>
      </section>
    </>
  );
}
