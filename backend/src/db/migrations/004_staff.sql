-- Painel da equipe: contas, sessões e novos campos de status nos agendamentos.

-- Contas individuais. professional = vê só a própria agenda; admin = vê o salão inteiro.
CREATE TABLE staff_users (
  id              serial PRIMARY KEY,
  email           text NOT NULL CHECK (email = lower(email)),
  name            text NOT NULL,
  password_hash   text NOT NULL,             -- scrypt$N$r$p$salt$hash (nunca a senha)
  role            text NOT NULL CHECK (role IN ('admin', 'professional')),
  professional_id text REFERENCES professionals (id),
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (role = 'admin' OR professional_id IS NOT NULL)
);

CREATE UNIQUE INDEX staff_users_email_key ON staff_users (email);

-- Sessões de login. Guardamos só o hash do token; o token fica no cookie httpOnly.
CREATE TABLE staff_sessions (
  token_hash text PRIMARY KEY,
  user_id    integer NOT NULL REFERENCES staff_users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX staff_sessions_user_idx ON staff_sessions (user_id);

-- Novo status: a cliente não compareceu.
ALTER TABLE bookings DROP CONSTRAINT bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'done', 'no_show'));

-- Quem cancelou e quem da equipe mudou o status por último.
ALTER TABLE bookings
  ADD COLUMN cancelled_by text CHECK (cancelled_by IN ('customer', 'staff')),
  ADD COLUMN updated_by_staff_id integer REFERENCES staff_users (id) ON DELETE SET NULL;

-- Até aqui só a cliente conseguia cancelar.
UPDATE bookings SET cancelled_by = 'customer' WHERE status = 'cancelled' AND cancelled_by IS NULL;
