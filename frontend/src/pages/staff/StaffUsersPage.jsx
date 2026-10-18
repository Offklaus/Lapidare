import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useOutletContext } from 'react-router-dom';

import { Badge, Button, TextField } from '../../components/index.js';
import {
  deleteStaffInvite,
  getStaffAudit,
  getStaffProfessionals,
  getStaffUsers,
  inviteStaffUser,
  newStaffLink,
  resetStaff2fa,
  updateStaffUser,
} from '../../services/staffApi.js';
import useAsync from '../../hooks/useAsync.js';
import { Loading, LoadError } from '../booking/steps/StepStatus.jsx';

const ROLE_LABEL = { admin: 'Admin', professional: 'Profissional' };
const STATUS = {
  active: { tone: 'success', label: 'Ativa' },
  invited: { tone: 'warning', label: 'Convite pendente' },
  inactive: { tone: 'neutral', label: 'Desativada' },
};
const ACTIONS = {
  user_invited: 'convidou',
  invite_accepted: 'criou a senha',
  invite_resent: 'gerou um novo convite para',
  invite_deleted: 'excluiu um convite',
  password_reset_link: 'gerou um link de nova senha para',
  password_reset_done: 'criou uma senha nova',
  password_changed: 'trocou a própria senha',
  user_updated: 'alterou o acesso de',
  '2fa_enabled': 'ativou a verificação em duas etapas',
  '2fa_reset': 'reiniciou a verificação em duas etapas de',
};
const CONFIRM_TEXT = {
  deactivate: 'A pessoa sai na hora de todos os aparelhos e não consegue mais entrar. O histórico continua.',
  '2fa': 'A pessoa sai de todos os aparelhos e cadastra o app autenticador de novo no próximo acesso.',
  delete: 'O convite é apagado. Esta pessoa ainda não tinha entrado.',
};
const CONFIRM_BUTTON = {
  deactivate: 'Confirmar desativação',
  link: 'Gerar link',
  '2fa': 'Confirmar reinício',
  delete: 'Excluir convite',
};

const when = (iso) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
    : null;

const inviteUrl = (token) =>
  `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/equipe/convite/${token}`;

/** Link de convite/redefinição: aparece uma vez só, logo depois de criado. */
function LinkBox({ link, user, onClose }) {
  const url = inviteUrl(link.token);
  const [copied, setCopied] = useState(false);
  const first = user.name.split(' ')[0];
  const text =
    link.purpose === 'invite'
      ? `Olá, ${first}! Este é o seu acesso à área da equipe da Lapidare Beauty. Crie sua senha por este link (vale ${link.expiresInHours} h, uma vez só): ${url}`
      : `Olá, ${first}! Crie sua nova senha da área da equipe da Lapidare Beauty por este link (vale ${link.expiresInHours} h, uma vez só): ${url}`;

  return (
    <div className="staff-linkbox" role="status">
      <p className="t-body">
        <strong>{link.purpose === 'invite' ? 'Convite criado' : 'Link de nova senha criado'}</strong> para {user.name}.
        Envie só para a própria pessoa: o link vale {link.expiresInHours} h, uma vez só, e não aparece de novo.
      </p>
      <code className="staff-linkbox__url">{url}</code>
      <div className="staff-linkbox__actions">
        <Button
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? 'Copiado' : 'Copiar link'}
        </Button>
        <a
          className="lp-btn lp-btn--sm lp-btn--secondary"
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
        >
          Enviar pelo WhatsApp
        </a>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </div>
  );
}

/** Formulário de convite: nome, e-mail, perfil e, para profissional, de quem é a agenda. */
function InviteForm({ professionals, takenProfessionalIds, onCreated, onCancel, onSessionExpired }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'professional',
    professionalId: '',
    proName: '',
    proRole: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
    setError('');
  };
  const free = professionals.filter((p) => p.active && !takenProfessionalIds.includes(p.id));
  const isNewPro = form.professionalId === '__new__';

  const submit = async (event) => {
    event.preventDefault();
    const body = { name: form.name.trim(), email: form.email.trim(), role: form.role };
    if (form.role === 'professional') {
      if (isNewPro) body.newProfessional = { name: (form.proName || form.name).trim(), role: form.proRole.trim() };
      else body.professionalId = form.professionalId;
    }
    setSaving(true);
    setError('');
    try {
      onCreated(await inviteStaffUser(body));
    } catch (err) {
      if (err.status === 401) onSessionExpired();
      else setError(err.message || 'Não conseguimos criar o convite.');
      setSaving(false);
    }
  };

  return (
    <form className="staff-svc staff-svc--new" onSubmit={submit} noValidate aria-label="Convidar pessoa">
      <h2 className="t-heading-sm">Convidar pessoa</h2>
      <div className="staff-svc__fields">
        <TextField label="Nome" required maxLength={80} value={form.name} onChange={set('name')} />
        <TextField
          label="E-mail"
          required
          type="email"
          autoComplete="off"
          maxLength={200}
          value={form.email}
          onChange={set('email')}
        />
        <label className="lp-field">
          <span className="lp-field__label">Perfil *</span>
          <select className="lp-field__input" value={form.role} onChange={set('role')}>
            <option value="professional">Profissional: só a própria agenda</option>
            <option value="admin">Admin: área da equipe inteira e usuários</option>
          </select>
        </label>
        {form.role === 'professional' ? (
          <label className="lp-field">
            <span className="lp-field__label">Agenda de qual profissional *</span>
            <select className="lp-field__input" value={form.professionalId} onChange={set('professionalId')}>
              <option value="">Escolha</option>
              {free.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value="__new__">Profissional nova (contratada agora)</option>
            </select>
          </label>
        ) : null}
        {form.role === 'professional' && isNewPro ? (
          <>
            <TextField
              label="Nome para as clientes"
              hint="Como aparece no agendamento"
              maxLength={60}
              value={form.proName}
              placeholder={form.name}
              onChange={set('proName')}
            />
            <TextField label="Função" hint="Ex.: Nail designer" maxLength={80} value={form.proRole} onChange={set('proRole')} />
          </>
        ) : null}
      </div>
      {form.role === 'admin' ? (
        <p className="t-caption t-muted">
          Admin vê dados de todas as clientes. No primeiro acesso, cadastra o app autenticador (2FA).
        </p>
      ) : null}
      {isNewPro ? (
        <p className="t-caption t-muted">
          Depois, marque em Profissionais quais serviços ela faz: só então ela aparece no agendamento.
        </p>
      ) : null}
      {error ? (
        <p className="staff-booking__error t-caption" role="alert">
          {error}
        </p>
      ) : null}
      <div className="staff-svc__actions">
        <Button type="submit" size="sm" loading={saving}>
          Criar convite
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/** Uma pessoa da equipe com as ações que a admin pode fazer (nunca na própria conta). */
function UserRow({ user, isSelf, professionals, takenProfessionalIds, onChanged, onLink, onSessionExpired }) {
  const [confirming, setConfirming] = useState(null); // 'deactivate' | 'link' | '2fa' | 'delete'
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState(user.role);
  const [professionalId, setProfessionalId] = useState(user.professionalId || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const status = STATUS[user.status];

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      setConfirming(null);
      setEditing(false);
    } catch (err) {
      if (err.status === 401) onSessionExpired();
      else setError(err.message || 'Não conseguimos salvar.');
    } finally {
      setBusy(false);
    }
  };

  const confirmAction = async () => {
    if (confirming === 'deactivate') onChanged((await updateStaffUser(user.id, { active: false })).user);
    if (confirming === '2fa') onChanged((await resetStaff2fa(user.id)).user);
    if (confirming === 'delete') {
      await deleteStaffInvite(user.id);
      onChanged(null, user.id);
    }
    if (confirming === 'link') {
      const res = await newStaffLink(user.id);
      onChanged(res.user);
      onLink(res.link, res.user);
    }
  };

  const proOptions = professionals.filter(
    (p) => p.active && (p.id === user.professionalId || !takenProfessionalIds.includes(p.id)),
  );
  const linkWarning =
    user.status === 'invited'
      ? 'O convite anterior deixa de valer.'
      : 'A senha atual deixa de valer e a pessoa sai de todos os aparelhos até criar a nova.';

  return (
    <article className={`staff-svc staff-user-row${user.active ? '' : ' is-inactive'}`}>
      <div className="staff-svc__head">
        <h3 className="t-title">
          {user.name}
          {isSelf ? <span className="t-caption t-muted"> (você)</span> : null}
        </h3>
        <Badge tone={status.tone}>{status.label}</Badge>
        <Badge tone="brand">{ROLE_LABEL[user.role]}</Badge>
      </div>
      <p className="t-body-sm t-muted staff-user-row__meta">
        {user.email}
        {user.professionalName ? ` · agenda de ${user.professionalName}` : ''}
        {user.role === 'admin' ? ` · 2FA ${user.twoFactor ? 'ativo' : 'pendente (cadastra no próximo acesso)'}` : ''}
        {user.lastLoginAt ? ` · último acesso ${when(user.lastLoginAt)}` : ' · ainda não entrou'}
        {user.linkExpiresAt ? ` · link vale até ${when(user.linkExpiresAt)}` : ''}
      </p>

      {editing ? (
        <div className="staff-svc__fields">
          <label className="lp-field">
            <span className="lp-field__label">Perfil</span>
            <select className="lp-field__input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="professional">Profissional</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          {role === 'professional' ? (
            <label className="lp-field">
              <span className="lp-field__label">Agenda de</span>
              <select className="lp-field__input" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
                <option value="">Escolha</option>
                {proOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      {confirming ? (
        <p className="t-caption t-muted">{confirming === 'link' ? linkWarning : CONFIRM_TEXT[confirming]}</p>
      ) : null}
      {error ? (
        <p className="staff-booking__error t-caption" role="alert">
          {error}
        </p>
      ) : null}

      {!isSelf ? (
        <div className="staff-svc__actions staff-user-row__actions">
          {editing ? (
            <>
              <Button
                size="sm"
                loading={busy}
                onClick={() =>
                  run(async () => {
                    const res = await updateStaffUser(user.id, {
                      role,
                      professionalId: role === 'professional' ? professionalId : null,
                    });
                    onChanged(res.user);
                  })
                }
              >
                Salvar perfil
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </>
          ) : null}
          {!editing && confirming ? (
            <>
              <Button
                size="sm"
                variant={confirming === 'link' ? 'primary' : 'danger'}
                loading={busy}
                onClick={() => run(confirmAction)}
              >
                {CONFIRM_BUTTON[confirming]}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(null)}>
                Voltar
              </Button>
            </>
          ) : null}
          {!editing && !confirming && user.active ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => setConfirming('link')}>
                {user.status === 'invited' ? 'Novo convite' : 'Novo link de senha'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                Mudar perfil
              </Button>
              {user.role === 'admin' && user.twoFactor ? (
                <Button size="sm" variant="secondary" onClick={() => setConfirming('2fa')}>
                  Reiniciar 2FA
                </Button>
              ) : null}
              {user.status === 'invited' && !user.lastLoginAt ? (
                <Button size="sm" variant="ghost" onClick={() => setConfirming('delete')}>
                  Excluir convite
                </Button>
              ) : null}
              <Button size="sm" variant="danger" onClick={() => setConfirming('deactivate')}>
                Desativar
              </Button>
            </>
          ) : null}
          {!editing && !confirming && !user.active ? (
            <Button
              size="sm"
              variant="secondary"
              loading={busy}
              onClick={() => run(async () => onChanged((await updateStaffUser(user.id, { active: true })).user))}
            >
              Reativar
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default function StaffUsersPage() {
  const { user: me } = useOutletContext();
  const navigate = useNavigate();
  const isAdmin = me.role === 'admin';
  const list = useAsync(() => (isAdmin ? getStaffUsers() : Promise.resolve(null)), [isAdmin]);
  const pros = useAsync(() => (isAdmin ? getStaffProfessionals() : Promise.resolve([])), [isAdmin]);
  const audit = useAsync(() => (isAdmin ? getStaffAudit() : Promise.resolve(null)), [isAdmin]);
  const [users, setUsers] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [link, setLink] = useState(null); // { link, user } — mostrado uma vez

  useEffect(() => {
    if (list.data) setUsers(list.data.users);
  }, [list.data]);
  useEffect(() => {
    if (list.error?.status === 401) navigate('/equipe/entrar', { replace: true });
  }, [list.error, navigate]);

  if (!isAdmin) return <Navigate to="/equipe" replace />;

  const sessionExpired = () => navigate('/equipe/entrar', { replace: true });
  const takenProfessionalIds = (users || []).filter((u) => u.active && u.professionalId).map((u) => u.professionalId);
  const activeAdmins = (users || []).filter((u) => u.active && u.role === 'admin').length;
  const maxAdmins = list.data?.maxAdmins ?? 4;
  const changed = (next, removedId) => {
    setUsers((all) => (removedId ? all.filter((u) => u.id !== removedId) : all.map((u) => (u.id === next.id ? next : u))));
    audit.reload();
    pros.reload();
  };

  return (
    <div className="container staff-page">
      <header className="staff-page__head">
        <div className="staff-page__title">
          <span className="t-caps t-accent">Equipe</span>
          <h1 className="t-display-l">Usuários</h1>
          <p className="t-body t-muted">
            Quem entra na área da equipe. Admins ativas: {activeAdmins} de {maxAdmins}.
          </p>
        </div>
        {users && !inviting ? <Button onClick={() => setInviting(true)}>Convidar pessoa</Button> : null}
      </header>

      {link ? <LinkBox link={link.link} user={link.user} onClose={() => setLink(null)} /> : null}

      {list.loading && !users ? <Loading>Carregando usuários…</Loading> : null}
      {list.error && list.error.status !== 401 ? <LoadError error={list.error} onRetry={list.reload} /> : null}

      {users ? (
        <div className="staff-pros">
          {inviting ? (
            <InviteForm
              professionals={pros.data || []}
              takenProfessionalIds={takenProfessionalIds}
              onCancel={() => setInviting(false)}
              onSessionExpired={sessionExpired}
              onCreated={(res) => {
                setUsers((all) => [...all, res.user]);
                setInviting(false);
                setLink({ link: res.link, user: res.user });
                audit.reload();
                pros.reload();
              }}
            />
          ) : null}
          {users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              isSelf={u.id === me.id}
              professionals={pros.data || []}
              takenProfessionalIds={takenProfessionalIds}
              onChanged={changed}
              onLink={(l, user) => setLink({ link: l, user })}
              onSessionExpired={sessionExpired}
            />
          ))}
        </div>
      ) : null}

      <section className="staff-audit" aria-labelledby="audit-title">
        <h2 id="audit-title" className="t-heading-sm">
          Registro de ações
        </h2>
        <p className="t-body-sm t-muted">
          Quem deu, mudou ou tirou acessos (últimas 100 ações). Sem senhas nem dados de clientes.
        </p>
        {audit.data?.entries?.length ? (
          <ul className="staff-audit__list">
            {audit.data.entries.map((e) => (
              <li key={e.id}>
                <span className="t-caption t-muted">{when(e.at)}</span>{' '}
                <span className="t-body-sm">
                  {e.actor || 'Terminal do servidor'} {ACTIONS[e.action] || e.action}
                  {e.target && e.target !== e.actor ? ` ${e.target}` : ''}
                  {e.details?.to
                    ? ` (${ROLE_LABEL[e.details.from] || e.details.from} → ${ROLE_LABEL[e.details.to] || e.details.to})`
                    : ''}
                  {e.details?.active === false ? ' (desativou)' : ''}
                  {e.details?.active === true ? ' (reativou)' : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="t-body-sm t-muted">Nenhuma ação registrada ainda.</p>
        )}
      </section>
    </div>
  );
}
