/* Contra CSRF (um site de terceiros fazendo a pessoa logada alterar dados sem saber):
   pedidos que mudam dados (POST, PUT, PATCH, DELETE) só passam se o navegador disser que vieram do
   próprio site (cabeçalho Origin) ou de uma origem liberada. Sem Origin = não é um navegador moderno
   (curl, testes), que não carrega o cookie de ninguém por conta própria.
   Junto com o cookie SameSite e o corpo só em JSON, fecha essa porta em camadas. */
import { HttpError } from './errors.js';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export function sameOrigin(isAllowedOrigin) {
  return (req, res, next) => {
    if (SAFE.has(req.method)) return next();
    const origin = req.headers.origin;
    if (!origin) return next();
    if (origin !== 'null') {
      try {
        if (new URL(origin).host === req.headers.host) return next();
      } catch {
        // origem malformada: cai na recusa abaixo
      }
      if (isAllowedOrigin(origin)) return next();
    }
    throw new HttpError(403, 'Pedido recusado: ele não veio do site do salão.');
  };
}
