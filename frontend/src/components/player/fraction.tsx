'use client';
import { LocalizedText, useI18n } from '@/components/i18n';
import { useState, useEffect } from 'react';
import { Check, MousePointer2 } from 'lucide-react';
import type { PublicScene } from '@wonderlab/shared';
import type { SceneProps } from './types';
function point(radius: number, angle: number) {
  return { x: 200 + radius * Math.cos(angle), y: 190 + radius * Math.sin(angle) };
}
export function FractionScene({
  scene,
  onChange,
}: SceneProps<Extract<PublicScene, { type: 'FRACTION_PIZZA' }>>) {
  const { t } = useI18n();
  const [parts, setParts] = useState(scene.parts);
  const [selected, setSelected] = useState<number[]>([]);
  const complete = parts === scene.parts && selected.length === scene.target;
  useEffect(() => {
    onChange(complete ? { parts, selected: selected.length } : null);
  }, [parts, selected.length, complete, onChange]);
  const select = (index: number) =>
    setSelected((old) => (old.includes(index) ? old.filter((i) => i !== index) : [...old, index]));
  return (
    <div className="fraction-scene">
      <div className="stage-kicker">
        <span className="stage-step">
          <LocalizedText text="Let’s try it" />
        </span>
        <span className="stage-prompt">{scene.instructions}</span>
      </div>
      <div className="fraction-interaction">
        <div className="pizza-world">
          <svg
            viewBox="0 0 400 390"
            className="pizza-svg"
            role="group"
            aria-label={t(`Pizza divided into ${parts} equal slices`)}
          >
            <defs>
              <filter id="pizza-shadow">
                <feDropShadow
                  dx="0"
                  dy="12"
                  stdDeviation="10"
                  floodColor="#D9B79B"
                  floodOpacity=".2"
                />
              </filter>
            </defs>
            <ellipse cx="200" cy="345" rx="125" ry="14" fill="#E7D1C0" opacity=".5" />
            <circle cx="200" cy="190" r="156" fill="#FFF9EE" />
            <circle cx="200" cy="190" r="142" fill="#DCAA69" filter="url(#pizza-shadow)" />
            {Array.from({ length: parts }, (_, i) => {
              const a = -Math.PI / 2 + (i * 2 * Math.PI) / parts,
                b = a + (2 * Math.PI) / parts;
              const start = point(133, a),
                end = point(133, b),
                middle = (a + b) / 2;
              const topping = point(75, middle),
                topping2 = point(107, middle + 0.11);
              const active = selected.includes(i);
              return (
                <g
                  key={i}
                  role="button"
                  aria-label={t(`Slice ${i + 1}`)}
                  aria-pressed={active}
                  tabIndex={0}
                  onClick={() => select(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      select(i);
                    }
                  }}
                  className={'pizza-slice ' + (active ? 'selected' : '')}
                  style={{
                    transform: active
                      ? `translate(${Math.cos(middle) * 8}px,${Math.sin(middle) * 8}px)`
                      : undefined,
                  }}
                >
                  <path
                    d={`M200 190L${start.x} ${start.y}A133 133 0 ${b - a > Math.PI ? 1 : 0} 1 ${end.x} ${end.y}Z`}
                    fill={active ? '#D8C4EF' : '#F6D992'}
                    stroke="#FFF3DE"
                    strokeWidth="3"
                  />
                  <circle
                    cx={topping.x}
                    cy={topping.y}
                    r="13"
                    fill={active ? '#AA83CE' : '#E79A7D'}
                  />
                  <circle
                    cx={topping2.x}
                    cy={topping2.y}
                    r="8"
                    fill={active ? '#B28AD7' : '#EAAA89'}
                  />
                  <path
                    d={`M${topping.x - 6} ${topping.y - 26}q8-10 14-3`}
                    stroke={active ? '#B99BCA' : '#A1BB82'}
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                  {active && (
                    <path
                      d={`M${topping.x - 6} ${topping.y}l4 4 8-9`}
                      stroke="white"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </g>
              );
            })}
          </svg>
          <span className="pizza-click-note">
            <MousePointer2 size={13} />
            <LocalizedText text="Click a slice to select it" />
          </span>
        </div>
        <div className="fraction-result">
          <span>
            <LocalizedText text="You’ve selected" />
          </span>
          <div className="fraction-number">
            <strong>{selected.length}</strong>
            <i />
            <strong>{parts}</strong>
          </div>
          <p>
            <LocalizedText
              text={
                selected.length === 0
                  ? 'A whole lot of possibilities.'
                  : selected.length === 1 && parts === 4
                    ? 'One quarter of the whole!'
                    : `${selected.length} out of ${parts} equal parts.`
              }
            />
          </p>
          {complete ? (
            <div className="activity-success">
              <Check size={16} />
              <LocalizedText text="That’s one quarter. Nicely done!" />
            </div>
          ) : (
            <span className="fraction-target">
              <LocalizedText text={`Your challenge: ${scene.target}/${scene.parts} of the pizza`} />
            </span>
          )}
        </div>
      </div>
      <div className="pizza-parts-controls">
        <span>
          <LocalizedText text="How many equal slices?" />
        </span>
        <div>
          {[2, 4, 6, 8].map((n) => (
            <button
              key={n}
              className={parts === n ? 'active' : ''}
              aria-pressed={parts === n}
              onClick={() => {
                setParts(n);
                setSelected([]);
              }}
            >
              {n}
              <small>
                <LocalizedText text="slices" />
              </small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
