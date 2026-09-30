/* Opções de conexão com o Postgres, as mesmas para a API, o setup e os scripts.
   DATABASE_CA_CERT (opcional): certificado do servidor (PEM) — ex.: o do Supabase, em
   Database Settings → SSL. Com ele a conexão é criptografada E o certificado é conferido. */

export function connectionOptions(connectionString) {
  const ca = (process.env.DATABASE_CA_CERT || '').replace(/\\n/g, '\n').trim();
  if (!ca || !connectionString) return { connectionString };

  // Parâmetros de SSL na URL passariam por cima do certificado: quem manda é DATABASE_CA_CERT.
  const url = new URL(connectionString);
  for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) url.searchParams.delete(key);
  return { connectionString: url.toString(), ssl: { ca, rejectUnauthorized: true } };
}
