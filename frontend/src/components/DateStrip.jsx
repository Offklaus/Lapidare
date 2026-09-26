import { useEffect, useRef } from 'react';
import { cx, parseISODate, WEEKDAYS, MONTHS } from '../lib/format.js';

/** days: [{ date: 'YYYY-MM-DD', available: boolean }] */
export default function DateStrip({ days = [], value, onChange, label = 'Escolha o dia' }) {
  const strip = useRef(null);

  // No celular a faixa rola para o lado: garante que o dia escolhido fique à vista.
  useEffect(() => {
    const el = strip.current?.querySelector('.lp-date.is-selected');
    if (!el) return;
    const box = strip.current;
    const left = el.offsetLeft - box.offsetLeft;
    if (left < box.scrollLeft || left + el.offsetWidth > box.scrollLeft + box.clientWidth) {
      box.scrollLeft = Math.max(0, left - 8);
    }
  }, [value, days.length]);

  return (
    <div className="lp-dates" role="radiogroup" aria-label={label} ref={strip}>
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
