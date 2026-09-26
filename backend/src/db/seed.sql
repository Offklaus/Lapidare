-- Dados iniciais de exemplo. Nomes, preços e expediente são FICTÍCIOS: troque pelos reais do salão.
-- Pode rodar mais de uma vez: o que já existe é mantido.

INSERT INTO services (id, category, name, description, duration_min, price_cents, sort) VALUES
  ('manicure',           'Unhas',           'Manicure tradicional',            'Cutilagem, lixa e esmaltação.',                   45,  4500, 10),
  ('pedicure',           'Unhas',           'Pedicure',                        'Cutilagem, lixa e esmaltação dos pés.',           60,  5500, 20),
  ('esmaltacao-gel',     'Unhas',           'Esmaltação em gel',               'Brilho e duração de até 3 semanas.',              60,  9000, 30),
  ('alongamento-gel',    'Alongamento',     'Alongamento em gel',              'Aplicação completa com formato à sua escolha.',  150, 18000, 40),
  ('manutencao-gel',     'Alongamento',     'Manutenção do alongamento',       'Para quem já tem o alongamento feito aqui.',      90, 12000, 50),
  ('design-sobrancelha', 'Sobrancelhas',    'Design de sobrancelhas',          'Mapeamento e design com pinça.',                  40,  5000, 60),
  ('brow-lamination',    'Sobrancelhas',    'Brow lamination',                 'Fios alinhados e volume natural.',                60, 13000, 70),
  ('lash-lifting',       'Cílios',          'Lash lifting',                    'Curvatura dos fios naturais.',                    60, 14000, 80),
  ('extensao-cilios',    'Cílios',          'Extensão de cílios fio a fio',    'Efeito natural, fio a fio.',                     120, 20000, 90),
  ('nano-sobrancelha',   'Nanopigmentação', 'Nanopigmentação de sobrancelhas', 'Fios desenhados, resultado natural.',            150, 45000, 100),
  ('laser-axila',        'Laser',           'Depilação a laser — axilas',      'Sessão avulsa.',                                  20,  8000, 110)
ON CONFLICT (id) DO NOTHING;

INSERT INTO professionals (id, name, role, sort) VALUES
  ('pro-1', 'Profissional Um',   'Nail designer',                      10),
  ('pro-2', 'Profissional Dois', 'Designer de sobrancelhas e cílios',  20),
  ('pro-3', 'Profissional Três', 'Esteticista',                        30)
ON CONFLICT (id) DO NOTHING;

-- Quem faz o quê (por categoria do serviço).
INSERT INTO professional_services (professional_id, service_id)
SELECT p.id, s.id
FROM (VALUES
  ('pro-1', 'Unhas'), ('pro-1', 'Alongamento'),
  ('pro-2', 'Sobrancelhas'), ('pro-2', 'Cílios'), ('pro-2', 'Nanopigmentação'),
  ('pro-3', 'Laser'), ('pro-3', 'Sobrancelhas'), ('pro-3', 'Unhas')
) AS p (id, category)
JOIN services s ON s.category = p.category
ON CONFLICT DO NOTHING;

-- Expediente: segunda a sábado, 09:00–12:00 e 13:00–19:00 (almoço 12–13). Domingo fechado.
-- Só insere para quem ainda não tem expediente cadastrado.
INSERT INTO working_hours (professional_id, weekday, start_time, end_time)
SELECT p.id, d.weekday, w.start_time, w.end_time
FROM professionals p
CROSS JOIN generate_series(1, 6) AS d (weekday)
CROSS JOIN (VALUES (time '09:00', time '12:00'), (time '13:00', time '19:00')) AS w (start_time, end_time)
WHERE NOT EXISTS (SELECT 1 FROM working_hours wh WHERE wh.professional_id = p.id);
