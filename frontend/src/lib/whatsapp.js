/* Mensagens de WhatsApp enviadas pela equipe: o painel abre o WhatsApp do salão (link wa.me)
   com o texto pronto, e a pessoa só aperta enviar. Tom da marca: caloroso, direto, sem emoji. */
import { formatLongDate } from './format.js';

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
    `${booking.service.name} com ${booking.professional.name}`,
    `${formatLongDate(booking.date)}, às ${booking.time}`,
    '',
    `Código do agendamento: ${booking.code}`,
    `Para acompanhar ou cancelar${cancelRule}: ${trackUrl}`,
    '',
    'Te esperamos!',
  ].join('\n');
}
