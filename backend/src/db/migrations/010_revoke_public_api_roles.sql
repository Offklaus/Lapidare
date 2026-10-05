-- Supabase: os papéis anon e authenticated (usados pela API REST automática) vêm com permissão nas
-- tabelas do schema public. O RLS (migration 008) já bloqueia tudo; aqui tiramos também as permissões,
-- em camadas: se alguém desligar o RLS de uma tabela por engano, ela continua fechada.
-- A API do Lapidare conecta como dona das tabelas e não é afetada. Fora do Supabase (Postgres local),
-- esses papéis não existem e nada acontece.

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
    END IF;
  END LOOP;
END
$$;
