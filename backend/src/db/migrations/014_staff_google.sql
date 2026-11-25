-- Login da equipe com Google (além de e-mail e senha). Só entra quem uma admin cadastrou em Usuários com
-- aquele e-mail. No primeiro login, a conta Google fica presa à conta da equipe pelo "sub" (identificador
-- fixo do Google, que não muda nem se o e-mail mudar); depois disso só aquela conta Google entra.
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS google_sub text;

CREATE UNIQUE INDEX IF NOT EXISTS staff_users_google_sub_key
    ON staff_users (google_sub) WHERE google_sub IS NOT NULL;
