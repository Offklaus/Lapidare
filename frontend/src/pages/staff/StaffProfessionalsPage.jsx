import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useOutletContext } from 'react-router-dom';

import { Avatar, Button, TextField } from '../../components/index.js';
import { getStaffProfessionals, updateProfessional } from '../../services/staffApi.js';
import useAsync from '../../hooks/useAsync.js';
import { Loading, LoadError } from '../booking/steps/StepStatus.jsx';

/** Um cartão por profissional: nome e função (os dois aparecem para as clientes). */
function ProfessionalForm({ professional, onSessionExpired }) {
  const [saved, setSaved] = useState(professional);
  const [name, setName] = useState(professional.name);
  const [role, setRole] = useState(professional.role || '');
  const [error, setError] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const changed = name.trim() !== saved.name || role.trim() !== (saved.role || '');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError('O nome precisa ter pelo menos 2 letras.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await updateProfessional(professional.id, { name, role });
      setSaved(updated);
      setName(updated.name);
      setRole(updated.role || '');
      setJustSaved(true);
    } catch (err) {
      if (err.status === 401) onSessionExpired();
      else setError(err.message || 'Não conseguimos salvar. Tente de novo.');
    } finally {
      setSaving(false);
    }
  };

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

  useEffect(() => {
    if (list.error?.status === 401) navigate('/equipe/entrar', { replace: true });
  }, [list.error, navigate]);

  // Só a admin edita profissionais; as outras voltam para a agenda.
  if (!isAdmin) return <Navigate to="/equipe" replace />;

  return (
    <div className="container staff-page">
      <header className="staff-page__title">
        <span className="t-caps t-accent">Equipe</span>
        <h1 className="t-display-l">Profissionais</h1>
        <p className="t-body t-muted">O nome e a função aparecem para as clientes na hora de agendar.</p>
      </header>

      {list.loading && !list.data ? <Loading>Carregando profissionais…</Loading> : null}
      {list.error && list.error.status !== 401 ? <LoadError error={list.error} onRetry={list.reload} /> : null}

      <div className="staff-pros">
        {(list.data || []).map((p) => (
          <ProfessionalForm
            key={p.id}
            professional={p}
            onSessionExpired={() => navigate('/equipe/entrar', { replace: true })}
          />
        ))}
      </div>
    </div>
  );
}
