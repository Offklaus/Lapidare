-- Agendamento pelo painel (recepção/admin) para clientes que marcam por WhatsApp, Direct ou telefone.

-- Cadastro de clientes: um registro por WhatsApp (só dígitos, com DDD). Quem já agendou pelo site entra aqui.
CREATE TABLE clients (
  id                  serial PRIMARY KEY,
  name                text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  phone               text NOT NULL UNIQUE CHECK (phone ~ '^[0-9]{10,11}$'),
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by_staff_id integer REFERENCES staff_users (id) ON DELETE SET NULL
);
CREATE INDEX clients_name_idx ON clients (lower(name));

-- Nome mais recente de cada WhatsApp; data do primeiro agendamento.
INSERT INTO clients (name, phone, created_at)
SELECT DISTINCT ON (customer_phone)
       customer_name,
       customer_phone,
       min(created_at) OVER (PARTITION BY customer_phone)
  FROM bookings
 WHERE customer_phone ~ '^[0-9]{10,11}$' AND char_length(customer_name) BETWEEN 2 AND 120
 ORDER BY customer_phone, created_at DESC
ON CONFLICT (phone) DO NOTHING;

ALTER TABLE bookings
  ADD COLUMN client_id integer REFERENCES clients (id) ON DELETE SET NULL,
  -- Por onde a cliente marcou: 'site' (ela mesma) ou o canal anotado pela recepção.
  ADD COLUMN origin text NOT NULL DEFAULT 'site'
             CHECK (origin IN ('site', 'whatsapp', 'instagram', 'telefone', 'presencial')),
  ADD COLUMN notes text CHECK (char_length(notes) <= 500),
  ADD COLUMN created_by_staff_id integer REFERENCES staff_users (id) ON DELETE SET NULL,
  -- Encaixe: horário escolhido fora da lista (pode ignorar expediente/folga, nunca outro atendimento —
  -- a trava bookings_no_overlap continua valendo).
  ADD COLUMN fit_in boolean NOT NULL DEFAULT false;

UPDATE bookings b SET client_id = c.id FROM clients c WHERE c.phone = b.customer_phone;

-- Mesma proteção das outras tabelas (migrations 008 e 010): a API REST do Supabase não lê nada.
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON TABLE clients FROM %I', r);
      EXECUTE format('REVOKE ALL ON SEQUENCE clients_id_seq FROM %I', r);
    END IF;
  END LOOP;
END
$$;
