/* Dados de um serviço vindos da área da equipe (aba Serviços). Mensagens dizem como corrigir. */
import { HttpError } from './errors.js';

export const MAX_PRICE = 100000; // R$ 100.000,00: acima disso é erro de digitação
export const MIN_DURATION = 5;
export const MAX_DURATION = 600; // mesmo limite da tabela services

/** "1.234,56" / "45,9" / "45.90" / "R$ 45" → número em reais (NaN se não for valor). */
export function parseMoney(text) {
  const t = String(text).replace(/R\$|\s/g, '');
  if (!/^\d[\d.,]*$/.test(t)) return NaN;
  // Com vírgula, ela é a dos centavos e os pontos separam milhar; sem vírgula, ponto é decimal.
  return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
}

const clean = (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');

/**
 * { name, category, description?, duration, price, active? } →
 * { name, category, description, durationMin, priceCents, active }
 * `price` em reais (número, ou texto como "45,90"); `duration` em minutos.
 */
export function parseServiceInput(body) {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Envie os dados do serviço.');

  const name = clean(body.name);
  if (name.length < 2 || name.length > 80) throw new HttpError(400, 'O nome do serviço precisa ter entre 2 e 80 caracteres.');

  const category = clean(body.category);
  if (category.length < 2 || category.length > 40) {
    throw new HttpError(400, 'A categoria precisa ter entre 2 e 40 caracteres (ex.: Unhas, Cílios).');
  }

  const description = clean(body.description ?? '');
  if (description.length > 200) throw new HttpError(400, 'A descrição pode ter no máximo 200 caracteres.');

  const durationMin = Number(body.duration);
  if (!Number.isInteger(durationMin) || durationMin < MIN_DURATION || durationMin > MAX_DURATION) {
    throw new HttpError(400, `A duração precisa ser em minutos inteiros, entre ${MIN_DURATION} e ${MAX_DURATION}.`);
  }

  const price = typeof body.price === 'string' ? parseMoney(body.price) : body.price;
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > MAX_PRICE) {
    throw new HttpError(400, 'Confira o preço: use só números, por exemplo 45,90.');
  }
  const priceCents = Math.round(price * 100);

  if (body.active !== undefined && typeof body.active !== 'boolean') throw new HttpError(400, 'active deve ser true ou false.');
  const active = body.active ?? true;

  return { name, category, description, durationMin, priceCents, active };
}

/** "Esmaltação em gel" → "esmaltacao-em-gel" (id do serviço, usado nos links e no banco). */
export function serviceSlug(name) {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '');
  return slug || 'servico';
}
