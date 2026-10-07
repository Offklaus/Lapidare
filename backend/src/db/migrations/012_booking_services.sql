-- Vários serviços no mesmo agendamento, em sequência e com a mesma profissional
-- (ex.: manicure 10:00–10:45 e pedicure 10:45–11:45). O agendamento continua sendo um só: um código,
-- um bloco de horário (starts_at → ends_at = soma das durações), um preço total (bookings.price_cents).
-- Aqui fica cada parte, na ordem, com a duração e o preço do momento do agendamento.

CREATE TABLE booking_services (
  booking_id   uuid NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  position     smallint NOT NULL CHECK (position BETWEEN 1 AND 10),
  service_id   text NOT NULL REFERENCES services (id),
  duration_min integer NOT NULL CHECK (duration_min > 0),
  price_cents  integer NOT NULL CHECK (price_cents >= 0),
  PRIMARY KEY (booking_id, position)
);
CREATE INDEX booking_services_service_idx ON booking_services (service_id);

-- Agendamentos que já existem: um serviço cada (o de bookings.service_id).
INSERT INTO booking_services (booking_id, position, service_id, duration_min, price_cents)
SELECT id, 1, service_id, greatest(1, (extract(epoch FROM ends_at - starts_at) / 60)::int), price_cents
  FROM bookings;

-- Mesma proteção das outras tabelas (migrations 008, 010 e 011).
ALTER TABLE booking_services ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON TABLE booking_services FROM %I', r);
    END IF;
  END LOOP;
END
$$;
