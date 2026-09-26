import Choice from './Choice.jsx';
import Avatar from './Avatar.jsx';
import Facet from './Facet.jsx';
import { cx } from '../lib/format.js';

/** `any` = variante "Primeiro horário livre" (losango no lugar da foto). */
export default function ProfessionalCard({ name, role, specialties = [], photo, selected, onSelect, any }) {
  return (
    <Choice selected={selected} onSelect={onSelect} className={cx('lp-pro', any && 'lp-pro--any')}>
      {any ? (
        <span className="lp-avatar lp-avatar--any" style={{ width: 56, height: 56 }} aria-hidden="true">
          <Facet size={24} />
        </span>
      ) : (
        <Avatar name={name} src={photo} />
      )}
      <span className="lp-pro__body">
        <span className="lp-pro__name">{name}</span>
        {role ? <span className="lp-pro__role">{role}</span> : null}
        {specialties.length ? (
          <span className="lp-pro__tags">
            {specialties.map((s) => (
              <span key={s} className="lp-tag">
                {s}
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </Choice>
  );
}
