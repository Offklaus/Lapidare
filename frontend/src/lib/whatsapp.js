/* Mensagens de WhatsApp enviadas pela equipe: o painel abre o WhatsApp do salão (link wa.me)
   com o texto pronto, e a pessoa só aperta enviar. Tom da marca: caloroso, direto, sem emoji. */
import { formatLongDate } from './format.js';

/** O que vai ser feito: um serviço numa linha; vários, um por linha com o horário de cada um. */
function whatLines(booking) {
  const list = booking.services || [];
  if (list.length > 1) {
    return [...list.map((s) => `${s.time} · ${s.name}`), `com ${booking.professional.name}`];
  }
  return [`${booking.service.name} com ${booking.professional.name}`];
}

/** Telefone salvo só com dígitos (DDD + número) → link wa.me com o texto já preenchido. */
export function whatsappLink(phoneDigits, text) {
  const base = `https://wa.me/55${phoneDigits}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** Texto da confirmação do agendamento. `siteUrl` é o endereço do site (onde a cliente acompanha). */
export function confirmationMessage(booking, { siteUrl, cancelMinHours }) {
  const firstName = booking.customer.name.trim().split(/\s+/)[0];
  const trackUrl = `${siteUrl.replace(/\/$/, '')}/acompanhar/${booking.code}`;
  const cancelRule = cancelMinHours > 0 ? ` (até ${cancelMinHours} h antes)` : '';

  return [
    `Olá, ${firstName}! Aqui é da Lapidare Beauty.`,
    '',
    'Seu horário está confirmado:',
    ...whatLines(booking),
    `${formatLongDate(booking.date)}, às ${booking.time}`,
    '',
    `Código do agendamento: ${booking.code}`,
    `Para acompanhar ou cancelar${cancelRule}: ${trackUrl}`,
    '',
    'Te esperamos!',
  ].join('\n');
}

/**
 * Lembrete da véspera (ou do próprio dia, se ficou para trás). booking.daysUntil: 1 = amanhã, 0 = hoje.
 * Na véspera normalmente já passou o prazo de cancelamento pelo site, então pede para responder a mensagem.
 */
export function reminderMessage(booking, { siteUrl }) {
  const firstName = booking.customer.name.trim().split(/\s+/)[0];
  const trackUrl = `${siteUrl.replace(/\/$/, '')}/acompanhar/${booking.code}`;
  const today = booking.daysUntil === 0;

  return [
    `Olá, ${firstName}! Passando para lembrar do seu horário ${today ? 'hoje' : 'amanhã'} na Lapidare Beauty:`,
    '',
    ...whatLines(booking),
    `${formatLongDate(booking.date)}, às ${booking.time}`,
    '',
    'Se não puder vir, é só responder esta mensagem.',
    `Detalhes do agendamento: ${trackUrl}`,
    '',
    today ? 'Te esperamos!' : 'Até amanhã!',
  ].join('\n');
}
