-- Contas das clientes (login com Google) para acompanhar as próprias reservas.
-- Totalmente separadas da equipe: outra tabela, outra sessão, outro cookie. Nunca dão acesso ao painel.

CREATE TABLE customers (
  id            serial PRIMARY KEY,
  google_sub    text NOT NULL,              -- id estável da conta Google ("sub" do token)
  email         text NOT NULL CHECK (email = lower(email)),
  name          text NOT NULL,
  picture_url   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX customers_google_sub_key ON customers (google_sub);
CREATE INDEX customers_email_idx ON customers (email);

CREATE TABLE customer_sessions (
  token_hash  text PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

CREATE INDEX customer_sessions_customer_idx ON customer_sessions (customer_id);

-- Reserva feita com a cliente logada fica ligada à conta.
ALTER TABLE bookings ADD COLUMN customer_id integer REFERENCES customers (id) ON DELETE SET NULL;
CREATE INDEX bookings_customer_idx ON bookings (customer_id);

-- "Minhas reservas" também encontra reservas antigas pelo e-mail (o Google confirma que o e-mail é dela).
CREATE INDEX bookings_customer_email_idx ON bookings (lower(customer_email));
