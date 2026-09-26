/* Validação dos dados da cliente. As mensagens dizem o que fazer. */
import { phoneDigits } from './format.js';

export function validateName(value) {
  const v = value.trim();
  if (!v) return 'Conte pra gente seu nome.';
  if (v.length < 2) return 'Escreva seu nome completo.';
  return '';
}

export function validatePhone(value) {
  const d = phoneDigits(value);
  if (!d) return 'Informe seu WhatsApp: é por lá que confirmamos o horário.';
  if (d.length < 10) return 'Confira o número: coloque o DDD e todos os dígitos.';
  return '';
}

export function validateEmail(value) {
  const v = value.trim();
  if (!v) return ''; // e-mail é opcional
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Confira o e-mail — parece incompleto.';
  return '';
}

export function validateCustomer(customer) {
  return {
    name: validateName(customer.name),
    phone: validatePhone(customer.phone),
    email: validateEmail(customer.email),
  };
}

export const hasErrors = (errors) => Object.values(errors).some(Boolean);
