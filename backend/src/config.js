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
  // Quantos dias o login da profissional dura antes de pedir a senha de novo.
  staffSessionDays: Number(process.env.STAFF_SESSION_DAYS) > 0 ? Math.floor(Number(process.env.STAFF_SESSION_DAYS)) : 7,
  // Admin vê dados de todas as clientes e gerencia usuários: sessão curta (horas).
  staffAdminSessionHours:
    Number(process.env.STAFF_ADMIN_SESSION_HOURS) > 0 ? Math.floor(Number(process.env.STAFF_ADMIN_SESSION_HOURS)) : 12,
  // E-mails (Google) que viram admin sozinhos no primeiro "Entrar com Google" da área da equipe, sem convite.
  // Separados por vírgula. Vazio = só entra quem foi cadastrado em Usuários.
  adminEmails: (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  // Quantas contas admin ativas podem existir ao mesmo tempo.
  maxAdmins: Number(process.env.MAX_ADMINS) > 0 ? Math.floor(Number(process.env.MAX_ADMINS)) : 4,
  // Chave para cifrar segredos no banco (2FA). Obrigatória em produção; gere com: openssl rand -base64 48
  appSecret: (process.env.APP_SECRET || '').trim(),
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
  // SÓ DESENVOLVIMENTO: botão "Entrar como admin (dev)" no login da equipe, sem senha nem 2FA (routes/staffDevLogin.js).
  devStaffLogin: process.env.DEV_STAFF_LOGIN === 'true',
};

// Trava: o atalho de desenvolvimento nunca liga em produção. Melhor o servidor não subir do que abrir o painel.
if (config.isProduction && config.devStaffLogin) {
  throw new Error('DEV_STAFF_LOGIN não pode estar ligado em produção. Remova a variável do ambiente.');
}
