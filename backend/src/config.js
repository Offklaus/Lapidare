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
  maxDays: 31,
};
