import { initials } from '../lib/format.js';

/** Foto redonda com aro dourado; sem foto, mostra as iniciais. */
export default function Avatar({ name, src, size = 56 }) {
  return (
    <span className="lp-avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}
