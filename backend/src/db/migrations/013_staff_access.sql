-- Acesso da equipe: convite por link, verificação em duas etapas (2FA) para admin e registro de ações.
-- Pensado para a LGPD: nada de senha, token ou segredo em texto puro; o registro guarda quem fez o quê,
-- sem dados de clientes.

-- Convidada ainda não tem senha (ela mesma cria pelo link do convite).
ALTER TABLE staff_users ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE staff_users
  -- Segredo do app autenticador, cifrado com AES-256-GCM (chave derivada de APP_SECRET).
  ADD COLUMN totp_secret_enc     text,
  ADD COLUMN totp_enabled_at     timestamptz,
  -- Último código aceito (passo de 30 s): o mesmo código não entra duas vezes.
  ADD COLUMN totp_last_step      bigint,
  ADD COLUMN password_changed_at timestamptz,
  ADD COLUMN last_login_at       timestamptz,
  ADD COLUMN created_by          integer REFERENCES staff_users (id) ON DELETE SET NULL,
  ADD COLUMN updated_at          timestamptz NOT NULL DEFAULT now();

UPDATE staff_users SET password_changed_at = created_at WHERE password_hash IS NOT NULL;

-- Uma conta ativa por profissional (a agenda dela não fica com duas pessoas).
CREATE UNIQUE INDEX staff_users_professional_active_key
    ON staff_users (professional_id) WHERE active AND professional_id IS NOT NULL;

-- Links de uso único: convite (criar a senha) e redefinição de senha. Só o hash SHA-256 fica no banco.
CREATE TABLE staff_tokens (
  token_hash text PRIMARY KEY,
  user_id    integer NOT NULL REFERENCES staff_users (id) ON DELETE CASCADE,
  purpose    text NOT NULL CHECK (purpose IN ('invite', 'reset')),
  created_by integer REFERENCES staff_users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at    timestamptz
);
CREATE INDEX staff_tokens_user_idx ON staff_tokens (user_id);

-- Etapa do login entre a senha e o código do app (admin): vale poucos minutos e poucas tentativas.
CREATE TABLE staff_login_challenges (
  token_hash         text PRIMARY KEY,
  user_id            integer NOT NULL REFERENCES staff_users (id) ON DELETE CASCADE,
  pending_secret_enc text,                  -- cadastro do 2FA em andamento (ainda não confirmado)
  attempts           smallint NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL
);
CREATE INDEX staff_login_challenges_user_idx ON staff_login_challenges (user_id);

-- Registro de ações sobre contas da equipe: quem fez, o quê, em quem e quando.
-- Nunca guarda senha, token, segredo do 2FA nem dados de clientes.
CREATE TABLE staff_audit_log (
  id             bigserial PRIMARY KEY,
  actor_id       integer REFERENCES staff_users (id) ON DELETE SET NULL,
  action         text NOT NULL,
  target_user_id integer REFERENCES staff_users (id) ON DELETE SET NULL,
  details        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX staff_audit_log_created_idx ON staff_audit_log (created_at DESC);

-- Mesma proteção das outras tabelas (migrations 008, 010–012): a API REST do Supabase não lê nada.
ALTER TABLE staff_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_login_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_audit_log ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON TABLE staff_tokens, staff_login_challenges, staff_audit_log FROM %I', r);
      EXECUTE format('REVOKE ALL ON SEQUENCE staff_audit_log_id_seq FROM %I', r);
    END IF;
  END LOOP;
END
$$;
