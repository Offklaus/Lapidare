import express from 'express';
import cors from 'cors';

import { config } from './config.js';
import { HttpError } from './lib/errors.js';
import { servicesRouter } from './routes/services.js';
import { professionalsRouter } from './routes/professionals.js';
import { availabilityRouter } from './routes/availability.js';
import { bookingsRouter } from './routes/bookings.js';

export const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json({ limit: '10kb' }));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/services', servicesRouter);
app.use('/professionals', professionalsRouter);
app.use('/availability', availabilityRouter);
app.use('/bookings', bookingsRouter);

app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada.' });
});

// Erros viram JSON { message } — o front mostra essa mensagem para a cliente.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'O corpo da requisição não é um JSON válido.' });
  }
  if (err.code === 'ECONNREFUSED' || err.code === '28P01' || err.code === '3D000') {
    console.error('Sem conexão com o banco:', err.message);
    return res.status(503).json({ message: 'O agendamento está fora do ar por alguns instantes. Tente de novo em breve.' });
  }
  console.error(err);
  return res.status(500).json({ message: 'Algo deu errado do nosso lado. Tente de novo em instantes.' });
});
