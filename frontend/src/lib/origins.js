/* Por onde a cliente marcou. 'site' = ela mesma, pelo agendamento online; os outros são anotados pela recepção. */

/** Canais que a recepção escolhe no "Novo agendamento" (mesma lista que o servidor aceita). */
export const ORIGINS = [
  ['whatsapp', 'WhatsApp'],
  ['instagram', 'Instagram Direct'],
  ['telefone', 'Telefone'],
  ['presencial', 'Presencial'],
];

export const ORIGIN_LABEL = Object.fromEntries([['site', 'Site'], ...ORIGINS]);
