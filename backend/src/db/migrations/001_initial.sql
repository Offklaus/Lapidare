-- Estrutura inicial do agendamento Lapidare.
-- Horários ficam em timestamptz; a API converte para o fuso do salão (SALON_TIMEZONE).

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE services (
  id           text PRIMARY KEY,
  category     text NOT NULL,
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  duration_min integer NOT NULL CHECK (duration_min > 0 AND duration_min <= 600),
  price_cents  integer NOT NULL CHECK (price_cents >= 0),
  sort         integer NOT NULL DEFAULT 0,
  active       boolean NOT NULL DEFAULT true
);

CREATE TABLE professionals (
  id        text PRIMARY KEY,
  name      text NOT NULL,
  role      text NOT NULL DEFAULT '',
  photo_url text,
  sort      integer NOT NULL DEFAULT 0,
  active    boolean NOT NULL DEFAULT true
);

-- Quais serviços cada profissional faz.
CREATE TABLE professional_services (
  professional_id text NOT NULL REFERENCES professionals (id) ON DELETE CASCADE,
  service_id      text NOT NULL REFERENCES services (id) ON DELETE CASCADE,
  PRIMARY KEY (professional_id, service_id)
);

-- Expediente semanal: uma linha por janela (ex.: 09:00–12:00 e 13:00–19:00 na mesma terça).
-- weekday: 0 = domingo … 6 = sábado.
CREATE TABLE working_hours (
  id              serial PRIMARY KEY,
  professional_id text NOT NULL REFERENCES professionals (id) ON DELETE CASCADE,
  weekday         smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time      time NOT NULL,
  end_time        time NOT NULL,
  CHECK (start_time < end_time)
);

CREATE INDEX working_hours_professional_idx ON working_hours (professional_id, weekday);

-- Folgas, férias e pausas pontuais (aparecem como "blocked").
CREATE TABLE time_off (
  id              serial PRIMARY KEY,
  professional_id text NOT NULL REFERENCES professionals (id) ON DELETE CASCADE,
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL,
  reason          text,
  CHECK (starts_at < ends_at)
);

CREATE INDEX time_off_professional_idx ON time_off (professional_id, starts_at);

CREATE TABLE bookings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id      text NOT NULL REFERENCES services (id),
  professional_id text NOT NULL REFERENCES professionals (id),
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'confirmed'
                  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'done')),
  customer_name   text NOT NULL,
  customer_phone  text NOT NULL,
  customer_email  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at),
  -- Garante no próprio banco que a mesma profissional não tem dois atendimentos ativos sobrepostos,
  -- mesmo com duas clientes confirmando ao mesmo tempo. Violação = erro 23P01 → API responde 409.
  CONSTRAINT bookings_no_overlap EXCLUDE USING gist (
    professional_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status IN ('pending', 'confirmed'))
);

CREATE INDEX bookings_professional_idx ON bookings (professional_id, starts_at);
