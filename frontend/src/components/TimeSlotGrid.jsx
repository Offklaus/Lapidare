import { cx } from '../lib/format.js';

const GROUPS = [
  ['Manhã', (t) => t < '12:00'],
  ['Tarde', (t) => t >= '12:00' && t < '18:00'],
  ['Noite', (t) => t >= '18:00'],
];

/** slots: [{ time: 'HH:MM', status: 'available' | 'booked' | 'blocked' }]. onChange recebe o slot inteiro como 2º argumento. */
export default function TimeSlotGrid({ slots = [], value, onChange, label = 'Horários disponíveis' }) {
  return (
    <div className="lp-slots" role="radiogroup" aria-label={label}>
      {GROUPS.map(([title, inGroup]) => {
        const list = slots.filter((s) => inGroup(s.time));
        if (!list.length) return null;
        return (
          <div key={title} className="lp-slots__group">
            <span className="lp-slots__title">{title}</span>
            <div className="lp-slots__grid">
              {list.map((s) => {
                const off = s.status !== 'available';
                const selected = value === s.time;
                return (
                  <button
                    key={s.time}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={off}
                    onClick={() => onChange?.(s.time, s)}
                    className={cx('lp-slot', selected && 'is-selected')}
                    aria-label={`${s.time}${off ? ' — indisponível' : ''}`}
                  >
                    {s.time}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
