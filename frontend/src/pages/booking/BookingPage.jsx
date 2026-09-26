import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { BookingSummary, Button, Stepper } from '../../components/index.js';
import { createBooking } from '../../services/api.js';
import { formatDuration, formatShortDate, phoneDigits } from '../../lib/format.js';
import { hasErrors, validateCustomer } from '../../lib/validation.js';
import { STEP, STEPS, bookingReducer, canAdvance, initialState } from './bookingReducer.js';

import ServiceStep from './steps/ServiceStep.jsx';
import ProfessionalStep from './steps/ProfessionalStep.jsx';
import DateTimeStep from './steps/DateTimeStep.jsx';
import CustomerStep from './steps/CustomerStep.jsx';
import ConfirmStep from './steps/ConfirmStep.jsx';

const COPY = [
  { title: 'Escolha o serviço', lead: 'Selecione o que você quer fazer. Na próxima etapa mostramos quem atende.' },
  { title: 'Escolha a profissional', lead: 'Mostramos só quem faz o serviço escolhido.' },
  { title: 'Escolha seu horário', lead: 'Dias riscados não têm horários livres.' },
  { title: 'Seus dados', lead: 'Usamos seu WhatsApp para confirmar o horário.' },
  { title: 'Confira e confirme', lead: 'Seu horário fica reservado assim que você confirmar.' },
];

const CANCEL_NOTE = 'Cancelamento grátis até 24 h antes.';

export default function BookingPage() {
  const [state, dispatch] = useReducer(bookingReducer, initialState);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const navigate = useNavigate();
  const headingRef = useRef(null);
  const firstRender = useRef(true);

  // A cada etapa: volta ao topo e leva o foco ao título (leitores de tela anunciam a etapa).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    headingRef.current?.focus();
  }, [state.step]);

  const { step, service, professional, professionals, date, time, slotProfessionalId, customer } = state;

  const attendedBy = useMemo(() => {
    if (!professional) return null;
    if (professional.id !== 'any') return professional.name;
    const pro = professionals.find((p) => p.id === slotProfessionalId);
    return pro ? pro.name : professional.name;
  }, [professional, professionals, slotProfessionalId]);

  const summaryItems = [
    { label: 'Serviço', value: service?.name || '—' },
    { label: 'Profissional', value: attendedBy || '—' },
    { label: 'Data', value: date ? formatShortDate(date) : '—' },
    { label: 'Horário', value: time || '—' },
    { label: 'Duração', value: service ? formatDuration(service.duration) : '—' },
  ];

  const goTo = (target) => dispatch({ type: 'GO_TO', step: target });

  const next = () => {
    if (step === STEP.CUSTOMER) {
      const errors = validateCustomer(customer);
      if (hasErrors(errors)) {
        dispatch({ type: 'SET_ERRORS', errors });
        return;
      }
    }
    if (canAdvance(state)) goTo(step + 1);
  };

  const back = () => {
    setSubmitError('');
    goTo(step - 1);
  };

  const confirm = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const booking = await createBooking({
        serviceId: service.id,
        professionalId: slotProfessionalId,
        date,
        time,
        customer: {
          name: customer.name.trim(),
          phone: phoneDigits(customer.phone),
          email: customer.email.trim() || undefined,
        },
      });
      navigate('/agendamento-confirmado', {
        state: { booking, items: summaryItems, total: service.price, customerName: customer.name.trim() },
      });
    } catch (err) {
      if (err.status === 409) {
        dispatch({ type: 'SLOT_CONFLICT', message: 'Esse horário acabou de ser reservado. Escolha outro abaixo.' });
      } else {
        setSubmitError(err.message || 'Não conseguimos confirmar agora. Tente de novo em instantes.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const confirmButton = (
    <Button variant="action" block loading={submitting} onClick={confirm}>
      Confirmar agendamento
    </Button>
  );

  const showAside = step >= STEP.PROFESSIONAL;

  return (
    <div className="container booking">
      <Stepper steps={STEPS} current={step} />

      <div className={showAside ? 'booking__grid' : 'booking__grid booking__grid--single'}>
        <section className="booking__step" aria-labelledby="booking-step-title">
          <header className="booking__step-head">
            <span className="t-caps t-accent">
              Etapa {step + 1} de {STEPS.length}
            </span>
            <h1 id="booking-step-title" className="t-display-l" tabIndex={-1} ref={headingRef}>
              {COPY[step].title}
            </h1>
            <p className="t-body t-muted">{COPY[step].lead}</p>
          </header>

          {step === STEP.SERVICE && (
            <ServiceStep selectedId={service?.id} onSelect={(s) => dispatch({ type: 'SELECT_SERVICE', service: s })} />
          )}

          {step === STEP.PROFESSIONAL && (
            <ProfessionalStep
              serviceId={service.id}
              selectedId={professional?.id}
              onSelect={(p) => dispatch({ type: 'SELECT_PROFESSIONAL', professional: p })}
              onLoaded={(list) => dispatch({ type: 'SET_PROFESSIONALS', professionals: list })}
            />
          )}

          {step === STEP.DATETIME && (
            <DateTimeStep
              serviceId={service.id}
              professionalId={professional.id}
              date={date}
              time={time}
              slotsVersion={state.slotsVersion}
              conflict={state.conflict}
              onSelectDate={(d) => dispatch({ type: 'SELECT_DATE', date: d })}
              onSelectTime={(t, slot) => dispatch({ type: 'SELECT_TIME', time: t, professionalId: slot.professionalId })}
            />
          )}

          {step === STEP.CUSTOMER && (
            <CustomerStep
              customer={customer}
              errors={state.errors}
              onChange={(field, value) => dispatch({ type: 'SET_CUSTOMER_FIELD', field, value })}
              onErrors={(errors) => dispatch({ type: 'SET_ERRORS', errors })}
              onSubmit={next}
            />
          )}

          {step === STEP.CONFIRM && (
            <ConfirmStep
              customer={customer}
              error={submitError}
              onEdit={() => goTo(STEP.CUSTOMER)}
              summary={<BookingSummary items={summaryItems} total={service.price} note={CANCEL_NOTE} />}
            />
          )}

          <div className="booking__actions">
            {step > STEP.SERVICE ? (
              <Button variant="secondary" onClick={back} disabled={submitting}>
                Voltar
              </Button>
            ) : (
              <span />
            )}
            {step < STEP.CONFIRM ? (
              <Button onClick={next} disabled={!canAdvance(state)}>
                Continuar
              </Button>
            ) : null}
          </div>
        </section>

        {showAside ? (
          <aside className="booking__aside">
            <BookingSummary
              items={summaryItems}
              total={service?.price}
              note={CANCEL_NOTE}
              action={step === STEP.CONFIRM ? confirmButton : null}
            />
          </aside>
        ) : null}
      </div>

      <div className="mobile-bar">
        {step > STEP.SERVICE ? (
          <Button variant="secondary" onClick={back} disabled={submitting}>
            Voltar
          </Button>
        ) : null}
        {step < STEP.CONFIRM ? (
          <Button onClick={next} disabled={!canAdvance(state)}>
            Continuar
          </Button>
        ) : (
          confirmButton
        )}
      </div>
    </div>
  );
}
