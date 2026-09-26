/* Limite de requisições por chave (padrão: IP), em memória — vale para um servidor só e zera ao reiniciar.
   Atrás de proxy/CDN em produção, configure app.set('trust proxy', …) para req.ip ser o IP real. */
export function rateLimit({ windowMs, max, message, key = (req) => req.ip }) {
  const hits = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [k, entry] of hits) if (entry.reset <= now) hits.delete(k);
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    const k = key(req);
    let entry = hits.get(k);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(k, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ message });
    }
    return next();
  };
}
