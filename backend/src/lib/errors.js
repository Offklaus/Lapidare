/** Erro com status HTTP; a mensagem vai para a cliente, então escreva o que ela deve fazer. */
export class HttpError extends Error {
  /** details (opcional): campos extras na resposta, ex.: { conflicts: [...] } num 409. */
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}
