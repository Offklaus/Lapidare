import { Link } from 'react-router-dom';

/** Política de privacidade (LGPD — Lei 13.709/2018). Texto simples, no tom da marca. */
export default function PrivacyPage() {
  return (
    <div className="container privacy">
      <header className="privacy__head">
        <span className="t-caps t-accent">Lapidare Beauty</span>
        <h1 className="t-display-l">Política de privacidade</h1>
        <p className="t-body t-muted">Como cuidamos dos seus dados. Última atualização: outubro de 2026.</p>
      </header>

      <section>
        <h2 className="t-heading-sm">Quais dados usamos e para quê</h2>
        <ul>
          <li>
            <strong>Para agendar:</strong> seu nome, WhatsApp e, se você quiser, e-mail. Servem só para marcar o
            horário, confirmar, lembrar na véspera e falar com você sobre o atendimento.
          </li>
          <li>
            <strong>Login com Google (opcional):</strong> nome, e-mail e foto da sua conta Google, para mostrar suas
            reservas em “Minhas reservas”. Não temos acesso à sua senha do Google.
          </li>
          <li>
            <strong>Segurança:</strong> registros técnicos mínimos (como limites de tentativas) para proteger o site
            contra abusos. Não usamos isso para mais nada.
          </li>
        </ul>
        <p>
          A base legal é a execução do serviço que você pediu (o agendamento) e, para a segurança do site, o
          legítimo interesse (LGPD, art. 7º, V e IX).
        </p>
      </section>

      <section>
        <h2 className="t-heading-sm">O que não fazemos</h2>
        <ul>
          <li>Não vendemos nem emprestamos seus dados.</li>
          <li>Não mandamos promoções sem você pedir.</li>
          <li>Não usamos cookies de propaganda nem de rastreamento.</li>
        </ul>
      </section>

      <section>
        <h2 className="t-heading-sm">Quem mais participa</h2>
        <p>
          Para o site funcionar, usamos serviços que guardam ou processam os dados em nosso nome: a hospedagem do site
          (Render), o banco de dados (Supabase) e, se você escolher, o login do Google. As mensagens de confirmação e
          lembrete são enviadas pela nossa equipe pelo WhatsApp.
        </p>
      </section>

      <section>
        <h2 className="t-heading-sm">Cookies</h2>
        <p>
          Só os essenciais: um cookie de sessão para manter você logada (e outro, separado, para a equipe do salão).
          Eles não servem para propaganda e vencem sozinhos.
        </p>
      </section>

      <section>
        <h2 className="t-heading-sm">Por quanto tempo</h2>
        <p>
          Os agendamentos ficam guardados como registro do atendimento, pelo tempo necessário para o salão e para
          cumprir obrigações legais. A conta de login fica até você excluir.
        </p>
      </section>

      <section>
        <h2 className="t-heading-sm">Como protegemos</h2>
        <p>
          Conexão criptografada (HTTPS), senhas da equipe guardadas só como “hash”, verificação em duas etapas para as
          administradoras, acesso de cada profissional limitado à própria agenda e registro de quem dá ou tira acessos.
        </p>
      </section>

      <section>
        <h2 className="t-heading-sm">Seus direitos</h2>
        <p>Você pode pedir para ver, corrigir, levar ou apagar seus dados, e saber com quem eles foram compartilhados.</p>
        <ul>
          <li>
            <strong>Apagar sua conta de login:</strong> em <Link to="/minhas-reservas">Minhas reservas</Link>, botão
            “Excluir minha conta”.
          </li>
          <li>
            <strong>Outros pedidos</strong> (como apagar um agendamento antigo): fale com a gente pelo WhatsApp do salão
            ou pelo Instagram{' '}
            <a href="https://instagram.com/lapidare.beauty" target="_blank" rel="noreferrer">
              @lapidare.beauty
            </a>
            . Respondemos em até 15 dias.
          </li>
        </ul>
      </section>
    </div>
  );
}
