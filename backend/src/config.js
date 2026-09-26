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
  maxDays: 31,
};
