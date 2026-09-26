-- Confirmação pelo WhatsApp: a equipe envia pelo link wa.me do painel e o sistema registra quando e quem.
ALTER TABLE bookings
  ADD COLUMN confirmation_sent_at timestamptz,
  ADD COLUMN confirmation_sent_by integer REFERENCES staff_users (id) ON DELETE SET NULL;
