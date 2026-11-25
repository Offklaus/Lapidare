/* Por onde a cliente marcou. 'site' = ela mesma, pelo agendamento online; os outros são anotados pela recepção. */

/** Canais que a recepção escolhe no "Novo agendamento" (mesma lista que o servidor aceita). */
export const ORIGINS = [
  ['whatsapp', 'WhatsApp'],
  ['telefone', 'Telefone'],
  ['presencial', 'Presencial'],
];

// 'instagram' saiu da lista (o salão não usa mais); o rótulo fica para agendamentos antigos anotados assim.
export const ORIGIN_LABEL = Object.fromEntries([['site', 'Site'], ['instagram', 'Instagram Direct'], ...ORIGINS]);
