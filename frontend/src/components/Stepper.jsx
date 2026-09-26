import { cx } from '../lib/format.js';

export default function Stepper({ steps = [], current = 0 }) {
  return (
    <ol className="lp-stepper">
      {steps.map((label, i) => (
        <li
          key={label}
          className={cx('lp-step', i < current && 'is-done', i === current && 'is-current')}
          aria-current={i === current ? 'step' : undefined}
        >
          <span className="lp-step__dot" aria-hidden="true">
            {i < current ? '✓' : i + 1}
          </span>
          <span className="lp-step__label">{label}</span>
        </li>
      ))}
    </ol>
  );
}
