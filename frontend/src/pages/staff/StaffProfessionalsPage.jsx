import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useOutletContext } from 'react-router-dom';

import { Avatar, Button, TextField } from '../../components/index.js';
import { getServices } from '../../services/api.js';
import { getStaffProfessionals, updateProfessional, updateProfessionalServices } from '../../services/staffApi.js';
import useAsync from '../../hooks/useAsync.js';
import { Loading, LoadError } from '../booking/steps/StepStatus.jsx';

const sameIds = (a, b) => a.length === b.length && [...a].sort().every((id, i) => id === [...b].sort()[i]);

/**
 * Um cartão por profissional: nome, função e os serviços que ela faz.
 * Os serviços marcados são os únicos que a cliente vê ao escolher esta profissional no agendamento.
 */
function ProfessionalForm({ professional, services, onSessionExpired }) {
  const [saved, setSaved] = useState(professional);
  const [name, setName] = useState(professional.name);
  const [role, setRole] = useState(professional.role || '');
  const [selected, setSelected] = useState(professional.serviceIds || []);
  const [error, setError] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const infoChanged = name.trim() !== saved.name || role.trim() !== (saved.role || '');
  const servicesChanged = !sameIds(selected, saved.serviceIds || []);
  const changed = infoChanged || servicesChanged;

  const categories = [...new Set(services.map((s) => s.category))];
  const checkedCount = services.filter((s) => selected.includes(s.id)).length;

  const toggle = (id) => {
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
    setJustSaved(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError('O nome precisa ter pelo menos 2 letras.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let next = { ...saved };
      if (infoChanged) next = { ...next, ...(await updateProfessional(professional.id, { name, role })) };
      if (servicesChanged) next.serviceIds = (await updateProfessionalServices(professional.id, selected)).serviceIds;
      setSaved(next);
      setName(next.name);
      setRole(next.role || '');
      setSelected(next.serviceIds || []);
      setJustSaved(true);
    } catch (err) {
      if (err.status === 401) onSessionExpired();
      else setError(err.message || 'Não conseguimos salvar. Tente de novo.');
    } finally {
      setSaving(false);
    }
  };

  const groupId = `servicos-${professional.id}`;

  return (
    <form className="staff-pro" onSubmit={handleSubmit} noValidate>
      <Avatar name={name || saved.name} size={48} />
      <div className="staff-pro__fields">
        <TextField
          label="Nome"
          required
          maxLength={60}
          value={name}
          error={error}
          onChange={(e) => {
            setName(e.target.value);
            setJustSaved(false);
            setError('');
          }}
        />
        <TextField
          label="Função"
          hint="Aparece abaixo do nome, ex.: Nail designer"
          maxLength={80}
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setJustSaved(false);
          }}
        />

        <div className="staff-pro__services" role="group" aria-labelledby={groupId}>
          <div className="staff-pro__services-head">
            <span id={groupId} className="t-label">
              Serviços que faz
            </span>
            <span className="t-caption t-muted">
              {checkedCount} de {services.length} serviços
            </span>
          </div>
          <p className="t-caption t-muted">
            Ao escolher esta profissional no agendamento, a cliente vê só os serviços marcados. Agendamentos já feitos
            não mudam.
          </p>

          {categories.map((category) => (
            <div key={category} className="staff-pro__category">
              <span className="lp-eyebrow">{category}</span>
              <div className="staff-pro__checks">
                {services
                  .filter((s) => s.category === category)
                  .map((s) => (
                    <label key={s.id} className="staff-check">
                      <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} />
                      <span>{s.name}</span>
                    </label>
                  ))}
              </div>
            </div>
          ))}

          {checkedCount === 0 ? (
            <div className="notice notice--warning" role="status">
              Sem nenhum serviço marcado, esta profissional não aparece para as clientes no agendamento.
            </div>
          ) : null}
        </div>
      </div>
      <div className="staff-pro__actions">
        <Button type="submit" size="sm" loading={saving} disabled={!changed}>
          Salvar
        </Button>
        {justSaved && !changed ? (
          <span className="t-caption staff-booking__sent" role="status">
            Salvo
          </span>
        ) : null}
        {!saved.active ? <span className="t-caption t-muted">Inativa</span> : null}
      </div>
    </form>
  );
}

export default function StaffProfessionalsPage() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const isAdmin = user.role === 'admin';
  const list = useAsync(() => (isAdmin ? getStaffProfessionals() : Promise.resolve([])), [isAdmin]);
  const services = useAsync(() => (isAdmin ? getServices() : Promise.resolve([])), [isAdmin]);

  useEffect(() => {
    if (list.error?.status === 401) navigate('/equipe/entrar', { replace: true });
  }, [list.error, navigate]);

  // Só a admin edita profissionais; as outras voltam para a agenda.
  if (!isAdmin) return <Navigate to="/equipe" replace />;

  const loading = (list.loading && !list.data) || (services.loading && !services.data);
  const error = (list.error?.status !== 401 && list.error) || services.error;

  return (
    <div className="container staff-page">
      <header className="staff-page__title">
        <span className="t-caps t-accent">Equipe</span>
        <h1 className="t-display-l">Profissionais</h1>
        <p className="t-body t-muted">
          Nome, função e os serviços de cada profissional aparecem para as clientes na hora de agendar.
        </p>
      </header>

      {loading ? <Loading>Carregando profissionais…</Loading> : null}
      {error ? (
        <LoadError
          error={error}
          onRetry={() => {
            list.reload();
            services.reload();
          }}
        />
      ) : null}

      {list.data && services.data ? (
        <div className="staff-pros">
          {list.data.map((p) => (
            <ProfessionalForm
              key={p.id}
              professional={p}
              services={services.data}
              onSessionExpired={() => navigate('/equipe/entrar', { replace: true })}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
