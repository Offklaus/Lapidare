/* IP de quem está acessando, usado nos limites de tentativa (rate limit).
   No Render o tráfego passa pelo Cloudflare e pelo balanceador; req.ip (trust proxy) acaba sendo o IP de um
   desses intermediários, que muda a cada conexão e é o mesmo para várias clientes. O Cloudflare sempre
   manda o IP real em CF-Connecting-IP (e sobrescreve o que a visitante tentar mandar nesse cabeçalho).
   CLIENT_IP_HEADER=cf-connecting-ip liga essa leitura; vazio = req.ip, como antes. */
import { isIP } from 'node:net';

export function clientIp(headerName) {
  const header = (headerName || '').trim().toLowerCase();
  return (req, res, next) => {
    const raw = header ? req.headers[header] : undefined;
    const value = typeof raw === 'string' ? raw.split(',')[0].trim() : '';
    req.clientIp = isIP(value) ? value : req.ip;
    next();
  };
}
