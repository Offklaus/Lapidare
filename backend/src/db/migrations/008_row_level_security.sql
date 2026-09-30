-- Supabase (e outros provedores) publica as tabelas do schema public numa API REST própria.
-- RLS ligado sem nenhuma política = essa API não lê nem grava nada.
-- A API do Lapidare continua funcionando: ela conecta como dona das tabelas, que não passa pelo RLS.
-- Tabela nova em migrations futuras: termine com ALTER TABLE ... ENABLE ROW LEVEL SECURITY.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END
$$;
