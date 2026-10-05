import { useEffect, useId, useState } from 'react';
import { Link, Navigate, useNavigate, useOutletContext } from 'react-router-dom';

import { Button, TextField } from '../../components/index.js';
import { createService, getStaffProfessionals, getStaffServices, updateService } from '../../services/staffApi.js';
import useAsync from '../../hooks/useAsync.js';
import { formatDuration, formatPrice } from '../../lib/format.js';
import { Loading, LoadError } from '../booking/steps/StepStatus.jsx';

/** 45.9 → "45,90" (como a equipe digita o preço). */
const priceText = (value) => value.toFixed(2).replace('.', ',');

/** "45,90" / "1.234,56" / "45" → 45.9; NaN se não for um valor. */
export function parseMoney(text) {
  const t = String(text).replace(/R\$|\s/g, '');
  if (!/^\d[\d.,]*$/.test(t)) return NaN;
  return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
}

const EMPTY = { name: '', category: '', description: '', duration: '60', price: '' };

const toDraft = (s) => ({
  name: s.name,
  category: s.category,
  description: s.description || '',
  duration: String(s.duration),
  price: priceText(s.price),
});

/** Confere o rascunho e devolve { errors, value } — value no formato da API. */
function checkDraft(draft) {
  const errors = {};
  const name = draft.name.trim();
  const category = draft.category.trim();
  const duration = Number(draft.duration);
  const price = parseMoney(draft.price);
  if (name.length < 2) errors.name = 'Escreva o nome do serviço.';
  if (category.length < 2) errors.category = 'Escolha ou escreva uma categoria, ex.: Unhas.';
  if (!Number.isInteger(duration) || duration < 5 || duration > 600) errors.duration = 'Em minutos, de 5 a 600.';
  if (Number.isNaN(price) || price < 0) errors.price = 'Use só números, ex.: 45,90.';
  else if (price > 100000) errors.price = 'Confira o valor: parece alto demais.';
  return { errors, value: { name, category, description: draft.description.trim(), duration, price } };
}

/** Campos comuns a criar e editar. `categories` vira sugestão no campo Categoria. */
function ServiceFields({ draft, errors, onChange, categories }) {
  const listId = useId();
  const set = (field) => (e) => onChange({ ...draft, [field]: e.target.value });
  return (
    <div className="staff-svc__fields">
      <TextField label="Nome" required maxLength={80} value={draft.name} error={errors.name} onChange={set('name')} />
      <TextField
        label="Categoria"
        required
        maxLength={40}
        list={listId}
        hint="Agrupa os serviços no agendamento"
        value={draft.category}
        error={errors.category}
        onChange={set('category')}
      />
      <datalist id={listId}>
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <TextField
        label="Preço (R$)"
        required
        inputMode="decimal"
        placeholder="0,00"
        maxLength={12}
        value={draft.price}
        error={errors.price}
        onChange={set('price')}
      />
      <TextField
        label="Duração (min)"
        required
        type="number"
        inputMode="numeric"
        min={5}
        max={600}
        step={5}
        value={draft.duration}
        error={errors.duration}
        hint={errors.duration ? undefined : Number(draft.duration) > 0 ? formatDuration(Number(draft.duration)) : undefined}
        onChange={set('duration')}
      />
      <div className="staff-svc__wide">
        <TextField
          label="Descrição"
          maxLength={200}
          hint="Uma linha que a cliente vê abaixo do nome"
          value={draft.description}
          onChange={set('description')}
        />
      </div>
    </div>
  );
}

/**
 * Um serviço já cadastrado. Fechado: nome, preço e duração com o botão Editar.
 * Aberto: muda nome, categoria, preço, duração, descrição e se está no agendamento.
 */
function ServiceForm({ service, categories, onSaved, onSessionExpired }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(service));
  const [active, setActive] = useState(service.active);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const saved = toDraft(service);
  const changed = Object.keys(saved).some((k) => draft[k].trim() !== saved[k]) || active !== service.active;
  const priceChanged = !Number.isNaN(parseMoney(draft.price)) && parseMoney(draft.price) !== service.price;
  const durationChanged = Number(draft.duration) !== service.duration;

  const openEditor = () => {
    setDraft(toDraft(service));
    setActive(service.active);
    setErrors({});
    setError('');
    setJustSaved(false);
    setOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const { errors: found, value } = checkDraft(draft);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setError('');
    try {
      const next = await updateService(service.id, { ...value, active });
      onSaved(next);
      setOpen(false);
      setJustSaved(true);
    } catch (err) {
      if (err.status === 401) onSessionExpired();
      else setError(err.message || 'Não conseguimos salvar. Tente de novo.');
    } finally {
      setSaving(false);
    }
  };

  const head = (
    <div className="staff-svc__head">
      <h3 className="t-title">{service.name}</h3>
      {!service.active ? <span className="staff-svc__tag">Fora do agendamento</span> : null}
      <span className="staff-svc__meta">
        <span className="staff-svc__price">{formatPrice(service.price)}</span>
        <span className="t-caption t-muted">{formatDuration(service.duration)}</span>
      </span>
    </div>
  );

  if (!open) {
    return (
      <div className={`staff-svc staff-svc--row${service.active ? '' : ' is-inactive'}`}>
        {head}
        {service.active && service.professionalCount === 0 ? (
          <p className="t-caption staff-svc__warn">Nenhuma profissional faz este serviço: as clientes não o veem.</p>
        ) : null}
        <div className="staff-svc__actions">
          {justSaved ? (
            <span className="t-caption staff-booking__sent" role="status">
              Salvo
            </span>
          ) : null}
          <Button size="sm" variant="secondary" onClick={openEditor} aria-label={`Editar ${service.name}`}>
            Editar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className={`staff-svc${service.active ? '' : ' is-inactive'}`} onSubmit={handleSubmit} noValidate>
      {head}

      <ServiceFields draft={draft} errors={errors} categories={categories} onChange={setDraft} />

      <label className="staff-check">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        <span>Disponível para agendamento</span>
      </label>

      {service.active && service.professionalCount === 0 ? (
        <div className="notice notice--warning" role="status">
          Nenhuma profissional faz este serviço, então ele não aparece para as clientes.{' '}
          <Link to="/equipe/profissionais">Marcar em Profissionais</Link>
        </div>
      ) : null}
      {priceChanged || durationChanged ? (
        <p className="t-caption t-muted">
          Vale para os próximos agendamentos. Os já marcados continuam com o preço e o horário combinados.
        </p>
      ) : null}
      {error ? (
        <p className="staff-booking__error t-caption" role="alert">
          {error}
        </p>
      ) : null}

      <div className="staff-svc__actions">
        <Button type="submit" size="sm" loading={saving} disabled={!changed}>
          Salvar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/** Formulário de serviço novo, já marcando quais profissionais fazem. */
function NewServiceForm({ categories, professionals, onCreated, onCancel, onSessionExpired }) {
  const [draft, setDraft] = useState(EMPTY);
  const [proIds, setProIds] = useState([]);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const groupId = useId();

  const toggle = (id) => setProIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  const handleSubmit = async (event) => {
    event.preventDefault();
    const { errors: found, value } = checkDraft(draft);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setError('');
    try {
      onCreated(await createService({ ...value, professionalIds: proIds }));
    } catch (err) {
      if (err.status === 401) onSessionExpired();
      else setError(err.message || 'Não conseguimos criar o serviço. Tente de novo.');
      setSaving(false);
    }
  };

  return (
    <form className="staff-svc staff-svc--new" onSubmit={handleSubmit} noValidate aria-label="Novo serviço">
      <div className="staff-svc__head">
        <h2 className="t-heading-sm">Novo serviço</h2>
      </div>
      <ServiceFields draft={draft} errors={errors} categories={categories} onChange={setDraft} />

      <div className="staff-pro__services" role="group" aria-labelledby={groupId}>
        <span id={groupId} className="t-label">
          Quem faz este serviço
        </span>
        <div className="staff-pro__checks">
          {professionals.map((p) => (
            <label key={p.id} className="staff-check">
              <input type="checkbox" checked={proIds.includes(p.id)} onChange={() => toggle(p.id)} />
              <span>{p.name}</span>
            </label>
          ))}
        </div>
        {proIds.length === 0 ? (
          <p className="t-caption t-muted">
            Sem ninguém marcado, o serviço fica cadastrado mas não aparece para as clientes até você marcar em
            Profissionais.
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="staff-booking__error t-caption" role="alert">
          {error}
        </p>
      ) : null}
      <div className="staff-svc__actions">
        <Button type="submit" size="sm" variant="action" loading={saving}>
          Criar serviço
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export default function StaffServicesPage() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const isAdmin = user.role === 'admin';
  const list = useAsync(() => (isAdmin ? getStaffServices() : Promise.resolve([])), [isAdmin]);
  const pros = useAsync(() => (isAdmin ? getStaffProfessionals() : Promise.resolve([])), [isAdmin]);
  const [services, setServices] = useState(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState('');

  useEffect(() => {
    if (list.data) setServices(list.data);
  }, [list.data]);

  useEffect(() => {
    if (list.error?.status === 401 || pros.error?.status === 401) navigate('/equipe/entrar', { replace: true });
  }, [list.error, pros.error, navigate]);

  // Só a admin mexe em serviços e preços; as outras voltam para a agenda.
  if (!isAdmin) return <Navigate to="/equipe" replace />;

  const sessionExpired = () => navigate('/equipe/entrar', { replace: true });
  const loading = !services && !list.error;
  const error = list.error?.status !== 401 ? list.error : null;
  const categories = services ? [...new Set(services.map((s) => s.category))] : [];

  return (
    <div className="container staff-page">
      <header className="staff-page__head">
        <div className="staff-page__title">
          <span className="t-caps t-accent">Equipe</span>
          <h1 className="t-display-l">Serviços e preços</h1>
          <p className="t-body t-muted">
            O que o salão oferece, quanto custa e quanto tempo leva. É o que as clientes veem na hora de agendar.
          </p>
        </div>
        {services && !creating ? (
          <Button
            variant="action"
            onClick={() => {
              setCreating(true);
              setCreated('');
            }}
          >
            Novo serviço
          </Button>
        ) : null}
      </header>

      {loading ? <Loading>Carregando serviços…</Loading> : null}
      {error ? <LoadError error={error} onRetry={list.reload} /> : null}

      {created ? (
        <div className="notice notice--success" role="status">
          Serviço “{created}” criado.
        </div>
      ) : null}

      {services ? (
        <div className="staff-pros">
          {creating ? (
            <NewServiceForm
              categories={categories}
              professionals={(pros.data || []).filter((p) => p.active)}
              onCancel={() => setCreating(false)}
              onSessionExpired={sessionExpired}
              onCreated={(service) => {
                setServices((all) => [...all, service]);
                setCreating(false);
                setCreated(service.name);
                pros.reload(); // a lista de serviços de cada profissional mudou
              }}
            />
          ) : null}

          {categories.map((category) => (
            <section key={category} className="staff-svc-group" aria-label={category}>
              <h2 className="lp-eyebrow">{category}</h2>
              {services
                .filter((s) => s.category === category)
                .map((s) => (
                  <ServiceForm
                    key={s.id}
                    service={s}
                    categories={categories}
                    onSessionExpired={sessionExpired}
                    onSaved={(next) => setServices((all) => all.map((x) => (x.id === next.id ? next : x)))}
                  />
                ))}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
