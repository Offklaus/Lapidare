-- Preço do serviço no momento do agendamento.
-- A equipe pode mudar o valor de um serviço (área da equipe → Serviços); agendamentos já feitos
-- continuam mostrando o preço combinado com a cliente.

ALTER TABLE bookings ADD COLUMN price_cents integer CHECK (price_cents >= 0);

UPDATE bookings b
   SET price_cents = s.price_cents
  FROM services s
 WHERE s.id = b.service_id;

ALTER TABLE bookings ALTER COLUMN price_cents SET NOT NULL;
