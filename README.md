# Lapidare Beauty — Agendamento

Webservice de agendamento do estúdio Lapidare (unhas, alongamento, sobrancelhas, cílios,
nanopigmentação e laser). A identidade visual vem do design system **Lapidare**.

```
Lapidare/
├── frontend/   React 18 + Vite, em JavaScript (JSX)
└── backend/    Node + Express 5 + PostgreSQL, em JavaScript
```

## Demonstração no GitHub Pages

A cada push na `main` que mexa em `frontend/`, o workflow `.github/workflows/deploy-pages.yml`
publica uma **demonstração** do site em `https://<usuario>.github.io/<repositorio>/`
(neste repositório: https://offklaus.github.io/Lapidare/).

- Roda em **modo de exemplo** (`VITE_USE_MOCK=true`): dados fictícios, sem API e sem banco. Dá para
  navegar, agendar e acompanhar/cancelar pelo código; o painel da equipe e o login ficam indisponíveis.
- Uma faixa no topo avisa que é demonstração e que os agendamentos não são reais.
- **Ativar uma vez:** no GitHub, *Settings → Pages → Build and deployment → Source: GitHub Actions*.
  Em conta gratuita, o Pages exige repositório **público**.
- O site mora numa subpasta: o build usa `VITE_BASE=/<repositorio>/` e copia o `index.html` para
  `404.html`, para as rotas internas (ex.: `/agendar`) abrirem ao recarregar.

## Produção no Render + Supabase

O site e a API rodam no **Render**; o banco é um Postgres no **Supabase**.
O `render.yaml` na raiz é um **Blueprint** que cria o serviço web `lapidare`. É um serviço só — a API
entrega o site compilado e responde em `/api` —, então site e API ficam no mesmo endereço e os
cookies de login funcionam.

**Supabase**
1. Crie o projeto na mesma região do Render (ex.: Supabase `us-east-2` com Render *Ohio*):
   cada consulta ao banco atravessa essa distância.
2. *Connect* → **Session pooler** (porta 5432, usuário `postgres.<id-do-projeto>`). Use essa URL.
   A conexão direta (`db.<id>.supabase.co`) só funciona por IPv6, e o Render não sai por IPv6.
3. *Database Settings → SSL* → baixe o certificado (`.crt`).
4. *Project Settings → Data API*: desligue. Nosso site não usa a API REST do Supabase. De qualquer
   forma a migration `008` liga RLS em todas as tabelas, e essa API não lê nem grava nada.

**Render**
1. *New → Blueprint* → escolha este repositório e preencha:
   - `DATABASE_URL`: a URL do Session pooler, com a senha do banco, **sem** `?sslmode`;
   - `DATABASE_CA_CERT`: o conteúdo do `.crt` (a conexão é criptografada e o servidor é conferido);
   - `GOOGLE_CLIENT_ID`.
2. A cada início o serviço roda `npm run db:migrate` (só migrations novas, sem mexer nos dados do salão).
3. No Google Cloud, adicione o endereço do site (ex.: `https://lapidare.onrender.com`) em
   *Origens JavaScript autorizadas*.

**Primeira vez:** coloque os dados iniciais e crie a conta da admin a partir do seu computador,
com a URL do Session pooler (aqui `uselibpqcompat=true` criptografa sem precisar do certificado):
```bash
cd backend
DATABASE_URL="<URL do Session pooler>?sslmode=require&uselibpqcompat=true" npm run db:setup
DATABASE_URL="<URL do Session pooler>?sslmode=require&uselibpqcompat=true" npm run staff:create
```
No Windows (PowerShell): `$env:DATABASE_URL="<URL do Session pooler>?sslmode=require&uselibpqcompat=true"`
antes dos comandos. A variável do terminal vale mais que o `backend/.env`.

Proteções em produção: cabeçalhos de segurança (helmet, com política de conteúdo que só libera o
próprio site, as fontes e o login do Google), `TRUST_PROXY=1` para os limites valerem por cliente,
limites de agendamento (`BOOKING_MAX_DAYS_AHEAD`, `BOOKING_MAX_ACTIVE_PER_PHONE`) e RLS no banco.
Tabela nova em migration futura: termine com `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.

## Rodando o back-end

Precisa do PostgreSQL rodando (testado com o 17).

```bash
cd backend
npm install
cp .env.example .env     # no Windows: copy .env.example .env
```

Edite `backend/.env` e coloque a senha do seu Postgres em `DATABASE_URL`. Depois:

```bash
npm run db:setup   # cria o banco "lapidare", as tabelas e os dados de exemplo
npm run db:migrate # só aplica migrations novas (é o que roda ao iniciar em produção)
npm run dev        # API em http://localhost:3333/api (reinicia sozinha ao salvar)
npm test           # testes do cálculo de horários
```

Para o front usar a API real, crie `frontend/.env` com `VITE_USE_MOCK=false` e reinicie o `npm run dev` do front.

### Estrutura do back-end

```
backend/
├── src/
│   ├── server.js              sobe o servidor
│   ├── app.js                 Express: cabeçalhos de segurança, CORS, rotas em /api, site compilado e erros
│   ├── config.js              variáveis de ambiente
│   ├── db/
│   │   ├── pool.js            conexão com o Postgres
│   │   ├── setup.js           cria o banco, aplica migrations e seed
│   │   ├── migrations/        SQL versionado (001_initial.sql, …)
│   │   └── seed.sql           dados de exemplo (fictícios)
│   ├── routes/                services, professionals, availability, bookings
│   ├── services/
│   │   ├── availability.js    cálculo de horários (funções puras)
│   │   └── schedule.js        busca expediente, agendamentos e folgas no banco
│   └── lib/                   datas/horários, validação, erros HTTP
└── test/                      node --test
```

### Regras de agenda

- **Expediente** (`working_hours`): janelas por dia da semana para cada profissional; pode haver mais de uma por dia (ex.: pausa para almoço).
- **Folgas e pausas** (`time_off`): aparecem como `blocked`.
- **Horários oferecidos**: a cada `SLOT_STEP_MIN` minutos, só quando a duração inteira do serviço cabe no expediente e não se sobrepõe a outro atendimento. Horários que já passaram vêm `blocked`.
- **Primeiro horário livre** (`professionalId=any`): em cada horário, a primeira profissional livre (pela ordem `sort`).
- **Sem agendamento duplo**: além da checagem na API, o próprio banco recusa dois atendimentos sobrepostos da mesma profissional (constraint `bookings_no_overlap`); a API responde `409`.
- Datas e horários são sempre no fuso `SALON_TIMEZONE` (padrão `America/Sao_Paulo`).

## Rodando o front-end

```bash
cd frontend
npm install
npm run dev
```

Abra http://localhost:5173.

Enquanto o back-end não existe, o front usa dados de exemplo (`src/services/mock.js`).
Para apontar para o servidor real, copie `.env.example` para `.env` e ajuste:

```
VITE_API_URL=http://localhost:3333/api
VITE_USE_MOCK=false
```

## Estrutura do front-end

```
frontend/src/
├── main.jsx                 entrada: router + estilos
├── App.jsx                  rotas: /, /agendar, /agendamento-confirmado, /acompanhar/:code
├── styles/
│   ├── tokens.css           cores (claro Marfim / escuro Oliva), fontes, espaçamentos, raios, sombras
│   ├── global.css           base e estilos tipográficos (.t-display-xl, .t-caps, .t-body…)
│   ├── components.css       estilos dos componentes do design system (.lp-*)
│   └── layout.css           header, rodapé, home, grade do agendamento, barra fixa mobile
├── components/              Button, TextField, Badge, ServiceCard, ProfessionalCard,
│                            DateStrip, TimeSlotGrid, Stepper, BookingSummary, Avatar, Facet
├── layout/SiteLayout.jsx    header, rodapé e alternância de tema
├── pages/
│   ├── HomePage.jsx
│   ├── BookingSuccessPage.jsx
│   ├── NotFoundPage.jsx
│   └── booking/             fluxo em 5 etapas (Profissional → Serviço → Data e horário → Seus dados → Confirmação)
├── services/
│   ├── api.js               cliente HTTP do contrato abaixo
│   └── mock.js              dados de exemplo no mesmo formato
├── hooks/                   useAsync, useTheme
└── lib/                     formatação pt-BR e validação
```

## Contrato com o back-end

Todas as rotas da API ficam sob **`/api`** (ex.: `GET /api/services`). O resto do endereço é do site:
em produção a própria API entrega o front compilado (`frontend/dist`).

| Método | Rota | Resposta |
| --- | --- | --- |
| GET | `/services?professionalId=` | `[{ id, category, name, description, duration, price }]` (duração em minutos, preço em reais) · com `professionalId`, só os serviços dessa profissional; sem ele ou `any`, todos |
| GET | `/professionals?serviceId=` | `[{ id, name, role, specialties, photo }]` |
| GET | `/availability?serviceId=&professionalId=\|any&from=YYYY-MM-DD&days=14` | `{ days: [{ date, available }] }` |
| GET | `/availability/slots?serviceId=&professionalId=&date=` | `[{ time: 'HH:MM', status: 'available'\|'booked'\|'blocked', professionalId }]` · nas duas rotas de disponibilidade, dias além de `BOOKING_MAX_DAYS_AHEAD` vêm indisponíveis/sem horários e há `429` após 120 consultas por minuto do mesmo IP |
| POST | `/bookings` | `201 { id, code: 'K7QM-4XZP', status: 'confirmed'\|'pending', professionalId }` · `409` se o horário foi reservado enquanto a cliente escolhia ou se o WhatsApp já tem `BOOKING_MAX_ACTIVE_PER_PHONE` agendamentos futuros · `400` além de `BOOKING_MAX_DAYS_AHEAD` dias · `429` após 10 agendamentos por hora do mesmo IP |
| GET | `/bookings/:code` | `{ code, status, date, time, isPast, customerFirstName, service: { name, duration, price }, professional: { name }, cancellation: { allowed, deadline: { date, time }, minHours } }` · `404` se o código não existe · `429` após 30 consultas em 10 min do mesmo IP |
| POST | `/bookings/:code/cancel` | corpo `{ phoneLast4 }` (4 últimos dígitos do WhatsApp) → `200` com o agendamento atualizado · `403` dígitos não conferem · `409` já cancelado, já aconteceu ou a menos de `CANCEL_MIN_HOURS` do horário · `429` após 5 tentativas por código por hora ou 10 por IP em 15 min |
| GET | `/health` | `{ ok: true }` |

Erros sempre voltam como `{ message }`, com um texto que pode ser mostrado para a cliente.

### Conta da cliente (login com Google)

As clientes entram em `/entrar` com a conta Google e veem as próprias reservas em `/minhas-reservas`.
A sessão da cliente (cookie `lp_customer`) é separada da equipe e **nunca** dá acesso ao painel.

| Método | Rota | Resposta |
| --- | --- | --- |
| GET | `/customer/config` | `{ googleClientId }` — `null` enquanto `GOOGLE_CLIENT_ID` não estiver no `.env` |
| POST | `/customer/login/google` | corpo `{ credential }` (ID token do botão do Google, conferido no servidor) → `{ customer }` + cookie · `401` token inválido ou e-mail não verificado · `503` login não configurado |
| POST | `/customer/logout` | `204` |
| GET | `/customer/me` | `{ customer: { id, name, email, picture } }` · `401` sem login |
| GET | `/customer/bookings` | reservas feitas logada + reservas com o mesmo e-mail do Google, mais recentes primeiro |

Reserva criada com a cliente logada (`POST /bookings` com o cookie) fica ligada à conta (`bookings.customer_id`).

**Configurar o Google** (uma vez):

1. Em https://console.cloud.google.com crie um projeto (ou use um existente).
2. *APIs e serviços → Tela de permissão OAuth*: tipo **Externo**, nome "Lapidare Beauty", e-mail de suporte; pode publicar em produção (só usa nome e e-mail).
3. *APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth*: tipo **Aplicativo da Web**.
4. Em **Origens JavaScript autorizadas**, adicione o endereço do site (em desenvolvimento, `http://localhost:5173`; depois, o domínio real com `https://`).
5. Copie o **ID do cliente** para `GOOGLE_CLIENT_ID` no `backend/.env` e reinicie a API.

### Painel da equipe (`/equipe` no site)

Rotas com cookie de sessão `httpOnly` (o front chama com `credentials: 'include'`):

| Método | Rota | Resposta |
| --- | --- | --- |
| POST | `/staff/login` | corpo `{ email, password }` → `{ user }` + cookie · `401` e-mail ou senha incorretos · `429` após 5 tentativas por e-mail em 15 min |
| POST | `/staff/logout` | `204` e apaga a sessão |
| GET | `/staff/me` | `{ user: { id, name, email, role: 'admin'\|'professional', professionalId } }` · `401` sem sessão |
| GET | `/staff/bookings?from=&to=&professionalId=` | `{ from, to, bookings: [{ id, code, status, cancelledBy, date, time, endTime, started, customer: { name, phone, email }, service, professional, actions: { cancel, done, noShow } }] }` — profissional sempre vê só a própria agenda; período de até 31 dias |
| POST | `/staff/bookings/:id/reminder-sent` | registra que a equipe enviou o lembrete pelo WhatsApp → agendamento atualizado com `reminderSentAt` · só para agendamentos de amanhã ou de hoje que ainda não começaram (`409` fora disso) |
| POST | `/staff/bookings/:id/confirmation-sent` | registra que a equipe enviou a confirmação pelo WhatsApp (quando e quem) → agendamento atualizado com `confirmationSentAt` · `409` se não está mais ativo |
| GET | `/staff/professionals` | só admin → `[{ id, name, role, active, serviceIds }]` · `403` para perfil profissional |
| PUT | `/staff/professionals/:id/services` | só admin · corpo `{ serviceIds: [...] }` substitui os serviços que a profissional faz (filtra os serviços e os horários do agendamento) → `{ id, serviceIds }` · `400` serviço inexistente |
| PATCH | `/staff/professionals/:id` | só admin · corpo `{ name, role }` (nome 2–60, função até 80 caracteres) → profissional atualizada · `403` para perfil profissional |
| PATCH | `/staff/bookings/:id/status` | corpo `{ status: 'done'\|'no_show'\|'cancelled' }` → agendamento atualizado · cancelar só antes do horário começar; concluído/faltou só depois · `409` quando não é permitido |

Contas são criadas pelo terminal (a senha é digitada sem aparecer):

```bash
cd backend
npm run staff:create                                    # pede nome, e-mail, perfil e senha
npm run staff:password -- --email pessoa@salao.com      # troca a senha e encerra as sessões
npm run staff:deactivate -- --email pessoa@salao.com    # tira o acesso
```

Perfis: `admin` vê a agenda do salão inteiro e filtra por profissional; `profissional` fica ligada a um cadastro de profissional e vê só a própria agenda.

Em produção, sirva o site e a API no mesmo domínio (ou subdomínios do mesmo site) para o cookie da sessão funcionar, e use HTTPS (`NODE_ENV=production` marca o cookie como `Secure`).

Corpo do `POST /bookings`:

```json
{
  "serviceId": "alongamento-gel",
  "professionalId": "pro-1",
  "date": "2026-09-29",
  "time": "16:00",
  "customer": { "name": "Nome da cliente", "phone": "11912345678", "email": "opcional@exemplo.com" }
}
```
