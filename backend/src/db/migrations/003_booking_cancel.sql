-- Quando a cliente (ou o salão) cancelou. O status continua em bookings.status ('cancelled').
-- A constraint bookings_no_overlap já ignora cancelados, então o horário fica livre na hora.
ALTER TABLE bookings ADD COLUMN cancelled_at timestamptz;
