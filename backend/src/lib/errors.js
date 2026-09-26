/** Erro com status HTTP; a mensagem vai para a cliente, então escreva o que ela deve fazer. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}
