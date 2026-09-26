/* Contas da equipe pelo terminal.
     npm run staff:create                             cria uma conta (pergunta os dados)
     npm run staff:password -- --email ana@salao.com  troca a senha e encerra as sessões abertas
     npm run staff:deactivate -- --email ana@salao.com  tira o acesso (a conta fica no histórico)
   A senha é digitada sem aparecer na tela. Para automação: variável de ambiente STAFF_PASSWORD. */
import readline from 'node:readline';
import pg from 'pg';

import { MIN_PASSWORD_LENGTH, hashPassword } from '../lib/password.js';

const [command, ...rest] = process.argv.slice(2);
const flags = {};
for (let i = 0; i < rest.length; i += 1) {
  if (rest[i].startsWith('--')) {
    flags[rest[i].slice(2)] = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[i + 1] : true;
  }
}

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Não ecoa o que é digitado; só a pergunta e a quebra de linha final.
      rl._writeToOutput = (text) => {
        if (text.startsWith(question)) process.stdout.write(question);
        else if (/[\r\n]/.test(text)) process.stdout.write('\n');
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      resolve(hidden ? answer : answer.trim());
    });
  });
}

async function askPassword() {
  if (process.env.STAFF_PASSWORD) {
    if (process.env.STAFF_PASSWORD.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }
    return process.env.STAFF_PASSWORD;
  }
  for (;;) {
    const password = await ask(`Senha (mínimo ${MIN_PASSWORD_LENGTH} caracteres): `, { hidden: true });
    if (password.length < MIN_PASSWORD_LENGTH) {
      console.log(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      continue;
    }
    const again = await ask('Repita a senha: ', { hidden: true });
    if (again === password) return password;
    console.log('As senhas não conferem. Tente de novo.');
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function askEmail() {
  let email = typeof flags.email === 'string' ? flags.email : await ask('E-mail: ');
  email = email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error('E-mail inválido.');
  return email;
}

async function create(client) {
  const name = typeof flags.name === 'string' ? flags.name : await ask('Nome: ');
  if (name.trim().length < 2) throw new Error('Informe o nome.');
  const email = await askEmail();

  let role = typeof flags.role === 'string' ? flags.role : await ask('Perfil (admin ou profissional): ');
  role = { admin: 'admin', profissional: 'professional', professional: 'professional' }[role.trim().toLowerCase()];
  if (!role) throw new Error('Perfil inválido: use admin ou profissional.');

  let professionalId = null;
  if (role === 'professional') {
    const { rows } = await client.query('SELECT id, name FROM professionals WHERE active ORDER BY sort, name');
    if (typeof flags.professional === 'string') {
      professionalId = flags.professional;
    } else {
      console.log('Profissionais cadastradas:');
      rows.forEach((p) => console.log(`  ${p.id}  ${p.name}`));
      professionalId = await ask('Id da profissional desta conta: ');
    }
    if (!rows.some((p) => p.id === professionalId)) throw new Error(`Profissional "${professionalId}" não encontrada.`);
  }

  const passwordHash = await hashPassword(await askPassword());
  try {
    await client.query(
      `INSERT INTO staff_users (email, name, password_hash, role, professional_id) VALUES ($1, $2, $3, $4, $5)`,
      [email, name.trim(), passwordHash, role, professionalId],
    );
  } catch (err) {
    if (err.code === '23505') throw new Error('Já existe uma conta com esse e-mail. Para trocar a senha: npm run staff:password -- --email ' + email);
    throw err;
  }
  console.log(`Conta criada: ${name.trim()} <${email}> — ${role === 'admin' ? 'admin (vê todas as agendas)' : `profissional (${professionalId})`}.`);
}

async function changePassword(client) {
  const email = await askEmail();
  const { rows } = await client.query('SELECT id FROM staff_users WHERE email = $1', [email]);
  if (!rows.length) throw new Error('Nenhuma conta com esse e-mail.');
  const passwordHash = await hashPassword(await askPassword());
  await client.query('UPDATE staff_users SET password_hash = $2, active = true WHERE id = $1', [rows[0].id, passwordHash]);
  await client.query('DELETE FROM staff_sessions WHERE user_id = $1', [rows[0].id]);
  console.log('Senha trocada. Sessões abertas em outros aparelhos foram encerradas.');
}

async function deactivate(client) {
  const email = await askEmail();
  const { rows } = await client.query('UPDATE staff_users SET active = false WHERE email = $1 RETURNING id', [email]);
  if (!rows.length) throw new Error('Nenhuma conta com esse e-mail.');
  await client.query('DELETE FROM staff_sessions WHERE user_id = $1', [rows[0].id]);
  console.log('Acesso removido. Para reativar, troque a senha com npm run staff:password.');
}

const COMMANDS = { create, password: changePassword, deactivate };

async function main() {
  if (!COMMANDS[command]) {
    console.error('Uso: npm run staff:create | staff:password -- --email X | staff:deactivate -- --email X');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('Defina DATABASE_URL no arquivo backend/.env.');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await COMMANDS[command](client);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
