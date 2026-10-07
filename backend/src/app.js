import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { config } from './config.js';
import { clientIp } from './lib/clientIp.js';
import { HttpError } from './lib/errors.js';
import { servicesRouter } from './routes/services.js';
import { professionalsRouter } from './routes/professionals.js';
import { availabilityRouter } from './routes/availability.js';
import { bookingsRouter } from './routes/bookings.js';
import { staffRouter } from './routes/staff.js';
import { customerRouter } from './routes/customer.js';

export const app = express();

app.disable('x-powered-by');
// Atrás do proxy do Render, req.ip passa a ser o IP real da cliente (limites de tentativa por pessoa).
app.set('trust proxy', config.trustProxy);
// IP real para os limites de tentativa (no Render: CLIENT_IP_HEADER=cf-connecting-ip). Ver lib/clientIp.js.
app.use(clientIp(config.clientIpHeader));

// Cabeçalhos de segurança. A política de conteúdo libera só o próprio site, as fontes do Google
// e o botão "Fazer login com o Google" (accounts.google.com).
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://accounts.google.com/gsi/client'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com/gsi/style'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://*.googleusercontent.com'],
        connectSrc: ["'self'", 'https://accounts.google.com/gsi/'],
        frameSrc: ['https://accounts.google.com/gsi/'],
        frameAncestors: ["'none'"], // ninguém coloca o site (e o painel da equipe) dentro de um iframe
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        // Só em produção (HTTPS): no computador o site roda em http://localhost.
        upgradeInsecureRequests: config.isProduction ? [] : null,
      },
    },
    strictTransportSecurity: config.isProduction,
    // A janelinha do login com Google precisa conversar com o site.
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }),
);

// Em desenvolvimento aceita qualquer porta de localhost; em produção, só CORS_ORIGIN.
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const allowOrigin = (origin) =>
  !origin || config.corsOrigins.includes(origin) || (!config.isProduction && LOCAL_ORIGIN.test(origin));

// credentials: o painel da equipe e a área da cliente usam cookie de sessão nas chamadas.
const api = express.Router();
api.use(cors({ origin: (origin, callback) => callback(null, allowOrigin(origin)), credentials: true }));
api.use(express.json({ limit: '10kb' }));

api.get('/health', (req, res) => res.json({ ok: true }));
api.use('/services', servicesRouter);
api.use('/professionals', professionalsRouter);
api.use('/availability', availabilityRouter);
api.use('/bookings', bookingsRouter);
api.use('/staff', staffRouter);
api.use('/customer', customerRouter);
api.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada.' });
});

// Toda a API fica em /api; o resto do endereço é do site.
app.use('/api', api);

// Produção num serviço só: a API também entrega o site compilado (frontend/dist), se ele existir.
// Assim site e API ficam no mesmo endereço e o cookie de login funciona.
const here = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(here, '../../frontend/dist');
if (existsSync(path.join(frontendDist, 'index.html'))) {
  // Arquivos com hash no nome (assets/) nunca mudam: cache longo. O index.html sempre é revalidado.
  app.use('/assets', express.static(path.join(frontendDist, 'assets'), { immutable: true, maxAge: '1y' }));
  // Arquivo de uma versão antiga do site: 404 (e não o index.html no lugar de um .js).
  app.use('/assets', (req, res) => res.status(404).end());
  app.use(express.static(frontendDist, { index: false, maxAge: 0 }));
  // Rotas do React (/agendar, /equipe…): devolve o app e o React Router mostra a página certa.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada.' });
});

// Erros viram JSON { message } — o front mostra essa mensagem para a cliente.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ ...err.details, message: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'O corpo da requisição não é um JSON válido.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Dados grandes demais. Confira o que foi enviado.' });
  }
  // Endereço malformado (ex.: %E0%A4%A) é erro de quem pediu, não do servidor.
  if (err instanceof URIError || err.status === 400) {
    return res.status(400).json({ message: 'Endereço inválido.' });
  }
  if (err.code === 'ECONNREFUSED' || err.code === '28P01' || err.code === '3D000') {
    console.error('Sem conexão com o banco:', err.message);
    return res.status(503).json({ message: 'O agendamento está fora do ar por alguns instantes. Tente de novo em breve.' });
  }
  console.error(err);
  return res.status(500).json({ message: 'Algo deu errado do nosso lado. Tente de novo em instantes.' });
});
