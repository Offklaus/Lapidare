/* Estado do fluxo de agendamento. */
import { MAX_SERVICES } from '../../lib/bookingServices.js';

/* A cliente escolhe a profissional primeiro e depois um ou mais serviços que ela faz (feitos em sequência). */
export const STEPS = ['Profissional', 'Serviço', 'Data e horário', 'Seus dados', 'Confirmação'];

export const STEP = { PROFESSIONAL: 0, SERVICE: 1, DATETIME: 2, CUSTOMER: 3, CONFIRM: 4 };

export const ANY_PROFESSIONAL = {
  id: 'any',
  name: 'Primeiro horário livre',
  role: 'A primeira profissional disponível',
};

export const initialState = {
  step: STEP.PROFESSIONAL,
  services: [], // na ordem em que serão feitos
  servicesOk: true, // "Primeiro horário livre": alguma profissional faz todos os serviços escolhidos?
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

const clearTime = { date: null, time: null, slotProfessionalId: null };

export function bookingReducer(state, action) {
  switch (action.type) {
    case 'SET_PROFESSIONALS':
      return { ...state, professionals: action.professionals };

    // Outra profissional pode não fazer os serviços já escolhidos: começa de novo a partir do serviço.
    case 'SELECT_PROFESSIONAL':
      if (state.professional?.id === action.professional.id) return state;
      return { ...state, professional: action.professional, services: [], servicesOk: true, ...clearTime };

    // Marca/desmarca um serviço. A ordem de escolha é a ordem em que serão feitos.
    case 'TOGGLE_SERVICE': {
      const chosen = state.services.some((s) => s.id === action.service.id);
      if (!chosen && state.services.length >= MAX_SERVICES) return state;
      const services = chosen
        ? state.services.filter((s) => s.id !== action.service.id)
        : [...state.services, action.service];
      return { ...state, services, ...clearTime };
    }

    case 'SET_SERVICES_OK':
      return state.servicesOk === action.ok ? state : { ...state, servicesOk: action.ok };

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
      return state.services.length > 0 && state.servicesOk;
    case STEP.DATETIME:
      return !!(state.date && state.time);
    case STEP.CUSTOMER:
      return true;
    default:
      return false;
  }
}
