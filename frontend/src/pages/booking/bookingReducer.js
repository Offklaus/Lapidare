/* Estado do fluxo de agendamento. */

/* A cliente escolhe a profissional primeiro e depois um dos serviços que ela faz. */
export const STEPS = ['Profissional', 'Serviço', 'Data e horário', 'Seus dados', 'Confirmação'];

export const STEP = { PROFESSIONAL: 0, SERVICE: 1, DATETIME: 2, CUSTOMER: 3, CONFIRM: 4 };

export const ANY_PROFESSIONAL = {
  id: 'any',
  name: 'Primeiro horário livre',
  role: 'A primeira profissional disponível',
};

export const initialState = {
  step: STEP.PROFESSIONAL,
  service: null,
  professional: null,
  professionals: [],
  date: null,
  time: null,
  slotProfessionalId: null, // quem atende de fato (resolve "Primeiro horário livre")
  customer: { name: '', phone: '', email: '' },
  errors: {},
  slotsVersion: 0, // muda para forçar recarga de dias/horários
  conflict: '', // mensagem do 409
};

export function bookingReducer(state, action) {
  switch (action.type) {
    case 'SET_PROFESSIONALS':
      return { ...state, professionals: action.professionals };

    // Outra profissional pode não fazer o serviço já escolhido: começa de novo a partir do serviço.
    case 'SELECT_PROFESSIONAL':
      if (state.professional?.id === action.professional.id) return state;
      return { ...state, professional: action.professional, service: null, date: null, time: null, slotProfessionalId: null };

    case 'SELECT_SERVICE':
      if (state.service?.id === action.service.id) return state;
      return { ...state, service: action.service, date: null, time: null, slotProfessionalId: null };

    case 'SELECT_DATE':
      if (state.date === action.date) return state;
      return { ...state, date: action.date, time: null, slotProfessionalId: null };

    case 'SELECT_TIME':
      return { ...state, time: action.time, slotProfessionalId: action.professionalId, conflict: '' };

    case 'SET_CUSTOMER_FIELD':
      return {
        ...state,
        customer: { ...state.customer, [action.field]: action.value },
        errors: { ...state.errors, [action.field]: '' },
      };

    case 'SET_ERRORS':
      return { ...state, errors: { ...state.errors, ...action.errors } };

    case 'GO_TO':
      return { ...state, step: action.step };

    case 'SLOT_CONFLICT':
      return {
        ...state,
        step: STEP.DATETIME,
        time: null,
        slotProfessionalId: null,
        conflict: action.message,
        slotsVersion: state.slotsVersion + 1,
      };

    default:
      return state;
  }
}

/** Pode avançar a partir da etapa atual? (a etapa de dados valida ao clicar) */
export function canAdvance(state) {
  switch (state.step) {
    case STEP.PROFESSIONAL:
      return !!state.professional;
    case STEP.SERVICE:
      return !!state.service;
    case STEP.DATETIME:
      return !!(state.date && state.time);
    case STEP.CUSTOMER:
      return true;
    default:
      return false;
  }
}
