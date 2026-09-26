-- Código curto que a cliente usa para acompanhar o agendamento (exibido como K7QM-4XZP).
-- Alfabeto sem I, O, 0 e 1 para não confundir na leitura: 32 símbolos, 8 posições.
ALTER TABLE bookings ADD COLUMN code text;

-- Agendamentos que já existem ganham um código (a referência a b.id faz o sorteio rodar por linha).
UPDATE bookings b
   SET code = (
     SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
       FROM generate_series(1, 8)
      WHERE b.id IS NOT NULL
   )
 WHERE code IS NULL;

ALTER TABLE bookings ALTER COLUMN code SET NOT NULL;
ALTER TABLE bookings ADD CONSTRAINT bookings_code_format CHECK (code ~ '^[A-HJ-NP-Z2-9]{8}$');
CREATE UNIQUE INDEX bookings_code_key ON bookings (code);
