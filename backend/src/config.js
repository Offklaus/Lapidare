/* Configuração lida das variáveis de ambiente (backend/.env). */

export const config = {
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 3333,
  databaseUrl: process.env.DATABASE_URL,
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  timezone: process.env.SALON_TIMEZONE || 'America/Sao_Paulo',
  slotStepMin: Number(process.env.SLOT_STEP_MIN) || 30,
  // Antecedência mínima (em horas) para a cliente cancelar sozinha pelo código. 0 = até o horário começar.
  cancelMinHours: Number.isInteger(Number(process.env.CANCEL_MIN_HOURS)) && process.env.CANCEL_MIN_HOURS !== ''
    ? Math.max(0, Number(process.env.CANCEL_MIN_HOURS))
    : 24,
  // Quantos dias o login da equipe dura antes de pedir a senha de novo.
  staffSessionDays: Number(process.env.STAFF_SESSION_DAYS) > 0 ? Math.floor(Number(process.env.STAFF_SESSION_DAYS)) : 7,
  // Login das clientes com Google: Client ID criado no Google Cloud (vazio = login com Google desligado).
  googleClientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),
  // Proxy na frente da API (Render, Nginx…): quantos saltos confiar para req.ip ser o IP real da cliente.
  // Padrão: 1 em produção, nenhum no computador. Sem isso, todas as clientes dividem os limites de tentativa.
  trustProxy: process.env.TRUST_PROXY !== undefined && process.env.TRUST_PROXY !== ''
    ? Number(process.env.TRUST_PROXY) || false
    : process.env.NODE_ENV === 'production' ? 1 : false,
  // Cabeçalho com o IP real da cliente, posto pela CDN (Render = Cloudflare → cf-connecting-ip). Vazio = req.ip.
  clientIpHeader: (process.env.CLIENT_IP_HEADER || '').trim(),
  // Proteção da agenda contra agendamentos falsos em massa.
  bookingMaxDaysAhead: Number(process.env.BOOKING_MAX_DAYS_AHEAD) > 0 ? Math.floor(Number(process.env.BOOKING_MAX_DAYS_AHEAD)) : 60,
  bookingMaxActivePerPhone:
    Number(process.env.BOOKING_MAX_ACTIVE_PER_PHONE) > 0 ? Math.floor(Number(process.env.BOOKING_MAX_ACTIVE_PER_PHONE)) : 3,
  customerSessionDays:
    Number(process.env.CUSTOMER_SESSION_DAYS) > 0 ? Math.floor(Number(process.env.CUSTOMER_SESSION_DAYS)) : 30,
  maxDays: 31,
};
