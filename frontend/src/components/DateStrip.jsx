import { cx, parseISODate, WEEKDAYS, MONTHS } from '../lib/format.js';

/** days: [{ date: 'YYYY-MM-DD', available: boolean }] */
export default function DateStrip({ days = [], value, onChange, label = 'Escolha o dia' }) {
  return (
    <div className="lp-dates" role="radiogroup" aria-label={label}>
      {days.map((d) => {
        const dt = parseISODate(d.date);
        const selected = value === d.date;
        return (
          <button
            key={d.date}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!d.available}
            onClick={() => onChange?.(d.date)}
            className={cx('lp-date', selected && 'is-selected')}
            aria-label={`${WEEKDAYS[dt.getDay()]}, ${dt.getDate()} de ${MONTHS[dt.getMonth()]}${d.available ? '' : ' — sem horários'}`}
          >
            <span className="lp-date__wd">{WEEKDAYS[dt.getDay()]}</span>
            <span className="lp-date__d">{dt.getDate()}</span>
            <span className="lp-date__m">{MONTHS[dt.getMonth()]}</span>
          </button>
        );
      })}
    </div>
  );
}
