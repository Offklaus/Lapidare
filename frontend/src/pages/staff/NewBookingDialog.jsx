import { useEffect, useId, useState } from 'react';

import { BookingSummary, Button, DateStrip, Modal, TextField, TimeSlotGrid } from '../../components/index.js';
import { getAvailability, getServices, getSlots } from '../../services/api.js';
import { createClient, createStaffBooking, getStaffProfessionals, searchClients } from '../../services/staffApi.js';
import useAsync from '../../hooks/useAsync.js';
import {
  formatDuration,
  formatLongDate,
  formatPhone,
  formatPrice,
  formatShortDate,
  phoneDigits,
  toISODate,
} from '../../lib/format.js';
import { MAX_SERVICES, endOf, servicesLines, totalDuration, totalPrice } from '../../lib/bookingServices.js';
import { ORIGINS } from '../../lib/origins.js';
import { Loading, LoadError } from '../booking/steps/StepStatus.jsx';
const DAYS_AHEAD = 31;

/** Busca de cliente com debounce; sem resultado, oferece o cadastro rápido (nome + WhatsApp). */
function ClientPicker({ value, onChange, onSessionExpired }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [quick, setQuick] = useState(null); // { name, phone } enquanto o cadastro rápido está aberto
  const [quickError, setQuickError] = useState('');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const listId = useId();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setSearching(false);
      return undefined;
    }
    let alive = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const list = await searchClients(q);
        if (alive) {
          setResults(list);
          setError('');
        }
      } catch (err) {
        if (!alive) return;
        if (err.status === 401) onSessionExpired();
        else setError(err.message || 'Não conseguimos buscar agora.');
      } finally {
        if (alive) setSearching(false);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const openQuick = () => {
    const digits = phoneDigits(query);
    setQuick(digits.length >= 8 ? { name: '', phone: digits } : { name: query.trim(), phone: '' });
    setQuickError('');
  };

  const saveQuick = async () => {
    const name = quick.name.trim();
    const phone = phoneDigits(quick.phone);
    if (name.length < 2) return setQuickError('Escreva o nome da cliente.');
    if (phone.length < 10) return setQuickError('Confira o WhatsApp: DDD e todos os dígitos.');
    setSaving(true);
    setQuickError('');
    try {
      const client = await createClient({ name, phone });
      setNote(client.existing ? `Esse WhatsApp já estava cadastrado como ${client.name}. Usamos o cadastro existente.` : '');
      setQuick(null);
      onChange(client);
    } catch (err) {
      if (err.status === 401) onSessionExpired();
      else setQuickError(err.message || 'Não conseguimos cadastrar. Tente de novo.');
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  if (value) {
    return (
      <div className="staff-nb__picked">
        <div>
          <span className="t-title">{value.name}</span>
          <span className="t-body-sm t-muted">WhatsApp {formatPhone(value.phone)}</span>
          {note ? <span className="t-caption t-muted">{note}</span> : null}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            onChange(null);
            setNote('');
          }}
        >
          Trocar
        </Button>
      </div>
    );
  }

  if (quick) {
    return (
      <div className="staff-nb__quick">
        <div className="staff-nb__row">
          <TextField
            label="Nome"
            required
            maxLength={120}
            autoComplete="off"
            value={quick.name}
            onChange={(e) => setQuick({ ...quick, name: e.target.value })}
          />
          <TextField
            label="WhatsApp"
            required
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="(11) 91234-5678"
            value={formatPhone(quick.phone)}
            onChange={(e) => setQuick({ ...quick, phone: phoneDigits(e.target.value) })}
          />
        </div>
        {quickError ? (
          <p className="staff-booking__error t-caption" role="alert">
            {quickError}
          </p>
        ) : null}
        <div className="staff-nb__actions">
          <Button size="sm" loading={saving} onClick={saveQuick}>
            Cadastrar cliente
          </Button>
          <Button size="sm" variant="ghost" disabled={saving} onClick={() => setQuick(null)}>
            Voltar para a busca
          </Button>
        </div>
      </div>
    );
  }

  const q = query.trim();
  return (
    <div className="staff-nb__search">
      <TextField
        label="Buscar cliente"
        hint="Nome ou WhatsApp"
        autoComplete="off"
        data-autofocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-controls={listId}
      />
      <div id={listId} className="staff-nb__results" aria-busy={searching || undefined}>
        {searching && !results ? <Loading>Buscando…</Loading> : null}
        {error ? (
          <p className="staff-booking__error t-caption" role="alert">
            {error}
          </p>
        ) : null}
        {results?.map((c) => (
          <button key={c.id} type="button" className="staff-nb__result" onClick={() => onChange(c)}>
            <span className="t-body">{c.name}</span>
            <span className="t-caption t-muted">
              {formatPhone(c.phone)}
              {c.bookings ? ` · ${c.bookings} ${c.bookings === 1 ? 'agendamento' : 'agendamentos'}` : ' · sem agendamentos'}
            </span>
          </button>
        ))}
        {results && !results.length ? <p className="t-body-sm t-muted">Nenhuma cliente encontrada com “{q}”.</p> : null}
      </div>
      {q.length >= 2 && results ? (
        <Button size="sm" variant="secondary" onClick={openQuick}>
          Cadastrar rápido
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Agendamento pela recepção (cliente que marcou por WhatsApp, Direct, telefone ou pessoalmente).
 * Usa os mesmos horários livres do site; o encaixe permite um horário fora da lista (com confirmação),
 * mas o servidor nunca deixa sobrepor outro atendimento.
 * initial: { professionalId, date, time } quando aberto a partir de um horário livre da agenda.
 * Montado de novo a cada abertura (a página usa `key`), então o estado começa limpo.
 */
export default function NewBookingDialog({ initial, onClose, onCreated, onSessionExpired }) {
  const today = toISODate(new Date());
  const [client, setClient] = useState(null);
  const [serviceIds, setServiceIds] = useState([]); // na ordem em que serão feitos (em sequência)
  const [professionalId, setProfessionalId] = useState(initial?.professionalId || '');
  const [date, setDate] = useState(initial?.date || today);
  const [time, setTime] = useState(initial?.time || '');
  const [fitIn, setFitIn] = useState(false);
  const [fitTime, setFitTime] = useState(initial?.time || '');
  const [confirmFitIn, setConfirmFitIn] = useState(false);
  const [origin, setOrigin] = useState('whatsapp');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [conflicts, setConflicts] = useState([]);
  const [slotsVersion, setSlotsVersion] = useState(0);

  const services = useAsync(() => getServices(), []);
  const pros = useAsync(() => getStaffProfessionals(), []);

  const chosen = serviceIds.map((id) => services.data?.find((s) => s.id === id)).filter(Boolean);
  const key = serviceIds.join(',');
  const duration = totalDuration(chosen);
  // Só quem faz TODOS os serviços escolhidos (são feitos em sequência pela mesma profissional).
  const proOptions = (pros.data || []).filter((p) => p.active && serviceIds.every((id) => p.serviceIds.includes(id)));
  const pro = proOptions.find((p) => p.id === professionalId) || null;
  const ready = !!(chosen.length && pro);

  // Profissional que não faz os serviços escolhidos sai; se só uma faz, já vem marcada.
  useEffect(() => {
    if (!serviceIds.length || !pros.data) return;
    if (professionalId && !proOptions.some((p) => p.id === professionalId)) setProfessionalId('');
    else if (!professionalId && proOptions.length === 1) setProfessionalId(proOptions[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pros.data]);

  const days = useAsync(
    () => (ready ? getAvailability({ serviceIds, professionalId, from: today, days: DAYS_AHEAD }) : Promise.resolve(null)),
    [ready, key, professionalId, today],
  );
  const slots = useAsync(
    () => (ready && date ? getSlots({ serviceIds, professionalId, date }) : Promise.resolve(null)),
    [ready, key, professionalId, date, slotsVersion],
  );

  // Horário escolhido que deixou de estar livre (outro serviço/profissional/dia) é desmarcado.
  useEffect(() => {
    if (slots.loading || !slots.data || !time) return;
    if (!slots.data.some((s) => s.time === time && s.status === 'available')) setTime('');
  }, [slots.loading, slots.data, time]);

  const stripDays =
    days.data?.days.map((d) => (fitIn ? { ...d, available: true } : d)) ||
    Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const d = new Date(`${today}T12:00:00`);
      d.setDate(d.getDate() + i);
      return { date: toISODate(d), available: false };
    });

  const chosenTime = fitIn ? fitTime : time;
  const endTime = chosen.length && chosenTime ? endOf(chosen, chosenTime) : '';
  const canSubmit =
    !!(client && chosen.length && pro && date && chosenTime && origin && (!fitIn || confirmFitIn)) && !submitting;

  const missing = [
    !client && 'a cliente',
    !chosen.length && 'o serviço',
    !pro && 'a profissional',
    !chosenTime && 'o horário',
    fitIn && chosenTime && !confirmFitIn && 'confirmar o encaixe',
  ].filter(Boolean);

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    setConflicts([]);
    try {
      const created = await createStaffBooking({
        clientId: client.id,
        serviceIds,
        professionalId,
        start: `${date}T${chosenTime}`,
        origin,
        notes: notes.trim() || undefined,
        fitIn,
        confirmFitIn: fitIn ? confirmFitIn : undefined,
      });
      onCreated(created);
    } catch (err) {
      if (err.status === 401) {
        onSessionExpired();
        return;
      }
      setError(err.message || 'Não conseguimos agendar. Tente de novo.');
      setConflicts(err.body?.conflicts || []);
      if (err.status === 409) setSlotsVersion((n) => n + 1); // a lista de horários mudou: recarrega
    } finally {
      setSubmitting(false);
    }
  };

  const categories = [...new Set((services.data || []).map((s) => s.category))];
  const originLabel = ORIGINS.find(([v]) => v === origin)?.[1];

  const footer = (
    <>
      <Button variant="ghost" onClick={onClose} disabled={submitting}>
        Cancelar
      </Button>
      <Button variant="action" onClick={submit} loading={submitting} disabled={!canSubmit}>
        Confirmar agendamento
      </Button>
    </>
  );

  return (
    <Modal open title="Novo agendamento" onClose={onClose} footer={footer}>
      <section className="staff-nb__section" aria-labelledby="nb-cliente">
        <h3 id="nb-cliente" className="lp-eyebrow">
          1 · Cliente
        </h3>
        <ClientPicker value={client} onChange={setClient} onSessionExpired={onSessionExpired} />
      </section>

      <section className="staff-nb__section" aria-labelledby="nb-servico">
        <h3 id="nb-servico" className="lp-eyebrow">
          2 · Serviços e profissional
        </h3>
        {services.error || pros.error ? (
          <LoadError
            error={services.error || pros.error}
            onRetry={() => {
              services.reload();
              pros.reload();
            }}
          />
        ) : null}
        {chosen.length ? (
          <ol className="staff-nb__services" aria-label="Serviços escolhidos, na ordem">
            {chosen.map((s, i) => (
              <li key={s.id}>
                <span className="staff-nb__services-name">
                  {chosen.length > 1 ? `${i + 1}º · ` : ''}
                  {s.name}
                </span>
                <span className="t-caption t-muted">
                  {formatDuration(s.duration)} · {formatPrice(s.price)}
                </span>
                <button
                  type="button"
                  className="staff-nb__remove"
                  aria-label={`Tirar ${s.name}`}
                  onClick={() => setServiceIds(serviceIds.filter((id) => id !== s.id))}
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
        ) : null}
        {chosen.length > 1 ? (
          <p className="t-caption t-muted">
            Feitos em sequência, nesta ordem, com a mesma profissional: {formatDuration(duration)} no total.
          </p>
        ) : null}
        <div className="staff-nb__row">
          <label className="lp-field">
            <span className="lp-field__label">{chosen.length ? 'Somar outro serviço' : 'Serviço *'}</span>
            <select
              className="lp-field__input"
              value=""
              disabled={serviceIds.length >= MAX_SERVICES}
              onChange={(e) => {
                const id = e.target.value;
                if (id && !serviceIds.includes(id)) setServiceIds([...serviceIds, id]);
              }}
            >
              <option value="">
                {serviceIds.length >= MAX_SERVICES
                  ? `Até ${MAX_SERVICES} serviços por agendamento`
                  : chosen.length
                    ? 'Escolha para somar à sequência'
                    : 'Escolha o serviço'}
              </option>
              {categories.map((cat) => (
                <optgroup key={cat} label={cat}>
                  {services.data
                    .filter((s) => s.category === cat && !serviceIds.includes(s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {formatDuration(s.duration)} · {formatPrice(s.price)}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="lp-field">
            <span className="lp-field__label">Profissional *</span>
            <select
              className="lp-field__input"
              value={professionalId}
              onChange={(e) => setProfessionalId(e.target.value)}
              disabled={!serviceIds.length}
            >
              <option value="">{serviceIds.length ? 'Escolha a profissional' : 'Escolha o serviço primeiro'}</option>
              {proOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {serviceIds.length && pros.data && !proOptions.length ? (
              <span className="lp-field__help">
                {serviceIds.length > 1
                  ? 'Nenhuma profissional faz todos esses serviços. Tire um deles ou marque em Profissionais.'
                  : 'Nenhuma profissional faz esse serviço. Marque em Profissionais.'}
              </span>
            ) : null}
          </label>
        </div>
      </section>

      <section className="staff-nb__section" aria-labelledby="nb-horario">
        <h3 id="nb-horario" className="lp-eyebrow">
          3 · Data e horário
        </h3>
        {!ready ? <p className="t-body-sm t-muted">Escolha o serviço e a profissional para ver os horários livres.</p> : null}
        {ready ? (
          <>
            <DateStrip
              days={stripDays}
              value={date}
              onChange={(d) => {
                setDate(d);
                setTime('');
              }}
              today={today}
              label="Dia do agendamento"
            />
            {!fitIn ? (
              <>
                {slots.loading && !slots.data ? <Loading>Carregando horários…</Loading> : null}
                {slots.error ? <LoadError error={slots.error} onRetry={slots.reload} /> : null}
                {slots.data && !slots.data.some((s) => s.status === 'available') ? (
                  <p className="t-body-sm t-muted">
                    Sem horários livres em {formatShortDate(date)}. Escolha outro dia ou use o encaixe.
                  </p>
                ) : null}
                {slots.data ? <TimeSlotGrid slots={slots.data} value={time} onChange={(t) => setTime(t)} /> : null}
              </>
            ) : null}

            <label className="staff-check">
              <input
                type="checkbox"
                checked={fitIn}
                onChange={(e) => {
                  setFitIn(e.target.checked);
                  setConfirmFitIn(false);
                  if (e.target.checked && !fitTime) setFitTime(time);
                }}
              />
              <span>Forçar horário (encaixe)</span>
            </label>
            {fitIn ? (
              <div className="staff-nb__fit">
                <div className="staff-nb__row">
                  <TextField
                    label="Horário do encaixe"
                    required
                    type="time"
                    step={300}
                    value={fitTime}
                    onChange={(e) => setFitTime(e.target.value)}
                    hint={endTime ? `Vai até ${endTime} (${formatDuration(duration)})` : undefined}
                  />
                </div>
                <div className="notice notice--warning">
                  O encaixe pode ficar fora do expediente ou de uma folga, mas nunca em cima de outro atendimento: se houver
                  sobreposição, mostramos qual é e nada é marcado.
                </div>
                <label className="staff-check">
                  <input type="checkbox" checked={confirmFitIn} onChange={(e) => setConfirmFitIn(e.target.checked)} />
                  <span>Confirmo o encaixe fora da lista de horários livres</span>
                </label>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="staff-nb__section" aria-labelledby="nb-origem">
        <h3 id="nb-origem" className="lp-eyebrow">
          4 · Origem e observações
        </h3>
        <div className="staff-nb__row">
          <label className="lp-field">
            <span className="lp-field__label">Por onde marcou *</span>
            <select className="lp-field__input" value={origin} onChange={(e) => setOrigin(e.target.value)}>
              {ORIGINS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="lp-field">
          <span className="lp-field__label">Observações</span>
          <textarea
            className="lp-field__input staff-nb__notes"
            maxLength={500}
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex.: prefere esmalte nude, alergia a acetona"
          />
          <span className="lp-field__help">{notes.length}/500</span>
        </label>
      </section>

      <BookingSummary
        items={[
          { label: 'Cliente', value: client ? `${client.name} · ${formatPhone(client.phone)}` : '—' },
          // Vários serviços: um por linha, com o horário de cada um.
          { label: chosen.length > 1 ? 'Serviços' : 'Serviço', value: chosen.length ? servicesLines(chosen, chosenTime) : '—' },
          { label: 'Profissional', value: pro ? pro.name : '—' },
          { label: 'Data', value: date ? formatLongDate(date) : '—' },
          {
            label: 'Horário',
            value: chosenTime ? `${chosenTime}${endTime ? ` às ${endTime}` : ''}${fitIn ? ' (encaixe)' : ''}` : '—',
          },
          { label: 'Duração', value: chosen.length ? formatDuration(duration) : '—' },
          { label: 'Origem', value: originLabel },
        ]}
        total={chosen.length ? totalPrice(chosen) : undefined}
        note={missing.length ? `Falta ${missing.join(', ')}.` : undefined}
      />

      {error ? (
        <div className="notice notice--danger" role="alert">
          <div>
            <p>{error}</p>
            {conflicts.length ? (
              <ul className="staff-nb__conflicts">
                {conflicts.map((c) => (
                  <li key={c.code}>
                    {c.time}–{c.endTime} · {c.customerName} · {c.service} (código {c.code})
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
