'use client';
import { LocalizedText, useI18n } from '@/components/i18n';
import { useState, useEffect } from 'react';
import { Check, MousePointer2 } from 'lucide-react';
import type { PublicScene } from '@wonderlab/shared';
import type { SceneProps } from './types';
type Diagram = Extract<PublicScene, { type: 'INTERACTIVE_DIAGRAM' | 'ANIMATION' }>;
export function DiagramScene({ scene, onChange, playing }: SceneProps<Diagram>) {
  const { t } = useI18n();

  const [selected, setSelected] = useState(scene.parts[0]);
  const [viewed, setViewed] = useState<string[]>([scene.parts[0].id]);
  useEffect(() => {
    onChange(viewed.length === scene.parts.length ? { viewedIds: viewed } : null);
  }, [viewed, scene.parts.length, onChange]);
  const select = (id: string) => {
    const part = scene.parts.find((p) => p.id === id);
    if (part) {
      setSelected(part);
      setViewed((v) => (v.includes(id) ? v : [...v, id]));
    }
  };
  return (
    <div className={'diagram-scene ' + (playing ? '' : 'paused')}>
      <span className="stage-prompt">{scene.instructions}</span>
      <div className="diagram-layout">
        <div className="diagram-canvas">
          {scene.diagram === 'HEART' ? (
            <svg viewBox="0 0 400 390" aria-label={t('Schematic four chamber heart')} role="group">
              <defs>
                <linearGradient id="heart-tissue" x1="100" y1="80" x2="300" y2="330">
                  <stop stopColor="#F7C7C1" />
                  <stop offset="1" stopColor="#E9ABA7" />
                </linearGradient>
              </defs>
              <path
                d="M178 98c-14-48-79-36-94 8-27 74 35 173 117 247 66-71 133-131 119-210-11-62-71-72-105-24z"
                fill="url(#heart-tissue)"
                stroke="#D5949C"
                strokeWidth="3"
              />
              <path
                d="M175 103V44q0-18 19-18h19v80M210 95V41h33v80"
                stroke="#DF9AA4"
                strokeWidth="20"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M107 117L77 71M286 142l52-28"
                stroke="#94B6D5"
                strokeWidth="16"
                strokeLinecap="round"
              />
              {scene.parts.map((part, i) => {
                const coords = [
                  [111, 135],
                  [125, 230],
                  [211, 143],
                  [209, 235],
                ][i % 4];
                return (
                  <g
                    key={part.id}
                    role="button"
                    tabIndex={0}
                    aria-label={part.label}
                    aria-pressed={selected.id === part.id}
                    onClick={() => select(part.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        select(part.id);
                      }
                    }}
                    className="heart-chamber"
                  >
                    <rect
                      x={coords[0]}
                      y={coords[1]}
                      width="69"
                      height={i % 2 === 0 ? 68 : 93}
                      rx={i % 2 === 0 ? 28 : 24}
                      fill={i < 2 ? '#C3D9E7' : '#EAAFA6'}
                      stroke={selected.id === part.id ? '#A184BD' : i < 2 ? '#AAC9DB' : '#D39390'}
                      strokeWidth={selected.id === part.id ? 4 : 2}
                    />
                    <text
                      x={coords[0] + 34}
                      y={coords[1] + 40}
                      textAnchor="middle"
                      fill={i < 2 ? '#688EA5' : '#BA7C78'}
                      fontSize="12"
                      fontWeight="700"
                    >
                      {['RA', 'RV', 'LA', 'LV'][i]}
                    </text>
                  </g>
                );
              })}
              <path d="M198 126l2 170" stroke="#F8DFD8" strokeWidth="6" strokeLinecap="round" />
              {scene.type === 'ANIMATION' && (
                <>
                  <path
                    id="blood-path"
                    d="M67 75L144 163L160 260L334 88L245 162L239 278L185 355"
                    fill="none"
                    stroke="#A799C2"
                    strokeWidth="3"
                    strokeDasharray="4 8"
                  />
                  <circle r="6" fill="#9DBADB" className="blood-cell">
                    <animateMotion dur="5s" repeatCount="indefinite">
                      <mpath href="#blood-path" />
                    </animateMotion>
                  </circle>
                  <circle r="5" fill="#E1979B">
                    <animateMotion dur="5s" begin="-2.5s" repeatCount="indefinite">
                      <mpath href="#blood-path" />
                    </animateMotion>
                  </circle>
                </>
              )}
            </svg>
          ) : scene.diagram === 'SOLAR_SYSTEM' ? (
            <svg viewBox="0 0 420 350" aria-label={t('Schematic solar system, not to scale')}>
              <ellipse cx="210" cy="185" rx="175" ry="106" stroke="#CEC1E0" strokeDasharray="3 7" />
              <ellipse cx="210" cy="185" rx="135" ry="83" stroke="#D8C8E5" strokeDasharray="3 7" />
              <circle cx="210" cy="185" r="39" fill="#F2D08C" />
              {scene.parts.map((part, i) => {
                const x = [265, 113, 324, 63][i % 4],
                  y = [146, 112, 223, 246][i % 4],
                  color = ['#C6BAB2', '#E6BE95', '#B2CCDD', '#DDA8A1'][i % 4];
                return (
                  <g
                    key={part.id}
                    role="button"
                    tabIndex={0}
                    aria-label={part.label}
                    onClick={() => select(part.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        select(part.id);
                      }
                    }}
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r={15 + i * 2}
                      fill={color}
                      stroke={selected.id === part.id ? '#AD88CC' : 'transparent'}
                      strokeWidth="4"
                    />
                    <text x={x} y={y + 35} fill="#A28DB5" fontSize="11" textAnchor="middle">
                      {part.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <svg viewBox="0 0 400 360" aria-label={t('Plant diagram')} role="group">
              <rect x="20" y="245" width="360" height="100" rx="16" fill="#EDD5B6" />
              <path d="M20 245H380" stroke="#C79E6C" strokeWidth="3" />
              {(['ROOTS', 'STEM', 'LEAVES'] as const).map((region) => {
                // Only explicit, trusted region IDs receive a spatial interaction.
                // Other concepts remain available through the accessible part list.
                const part = scene.parts.find((candidate) => plantRegion(candidate.id) === region);
                const active = plantRegion(selected.id) === region;
                const artwork = <PlantRegionArtwork region={region} active={active} />;
                return part ? (
                  <g
                    key={region}
                    role="button"
                    tabIndex={0}
                    aria-label={part.label}
                    aria-pressed={active}
                    onClick={() => select(part.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        select(part.id);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {artwork}
                  </g>
                ) : (
                  <g key={region} aria-hidden="true">
                    {artwork}
                  </g>
                );
              })}
            </svg>
          )}
          <span className="pizza-click-note">
            <MousePointer2 size={13} />
            <LocalizedText text="Select a part to explore it" />
          </span>
        </div>
        <div className="diagram-description">
          <span className="subject-tag mint">
            <LocalizedText text="Let’s take a closer look" />
          </span>
          <h3>{selected.label}</h3>
          <p>{selected.description}</p>
          <div className="diagram-part-list">
            {scene.parts.map((part) => (
              <button
                key={part.id}
                className={selected.id === part.id ? 'active' : ''}
                aria-pressed={selected.id === part.id}
                onClick={() => select(part.id)}
              >
                <span>{viewed.includes(part.id) ? <Check size={12} /> : <span />}</span>
                {part.label}
              </button>
            ))}
          </div>
          <span className="exploration-count">
            <LocalizedText text={`${viewed.length} of ${scene.parts.length} parts explored`} />
          </span>
          {viewed.length === scene.parts.length && (
            <div className="activity-success">
              <Check size={15} />
              <LocalizedText text="You’ve seen the bigger picture!" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type PlantRegion = 'ROOTS' | 'STEM' | 'LEAVES';
function plantRegion(id: string): PlantRegion | null {
  if (/^roots?(?:[_-]|$)/i.test(id)) return 'ROOTS';
  if (/^stem(?:[_-]|$)/i.test(id)) return 'STEM';
  if (/^(?:leaf|leaves)(?:[_-]|$)/i.test(id)) return 'LEAVES';
  return null;
}
function PlantRegionArtwork({ region, active }: { region: PlantRegion; active: boolean }) {
  const highlight = '#8B5DC7';
  if (region === 'ROOTS')
    return (
      <>
        <path
          d="M200 244V305M200 260L175 277L151 286M175 277L177 306M200 275L229 291L250 309M229 291L237 275M200 292L188 317M200 295L209 323"
          fill="none"
          stroke={active ? highlight : '#9A7148'}
          strokeWidth={active ? 9 : 7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M200 244V305M200 260L175 277L151 286M200 275L229 291L250 309"
          fill="none"
          stroke="transparent"
          strokeWidth="24"
        />
      </>
    );
  if (region === 'STEM')
    return (
      <>
        <path
          d="M200 244V77"
          fill="none"
          stroke={active ? highlight : '#629751'}
          strokeWidth={active ? 16 : 12}
          strokeLinecap="round"
        />
        <path d="M200 244V77" fill="none" stroke="transparent" strokeWidth="30" />
      </>
    );
  return (
    <>
      <path
        d="M199 143C164 89 114 89 97 100C101 143 144 168 199 143Z"
        fill={active ? '#CAEAA4' : '#9BCD79'}
        stroke={active ? highlight : '#629751'}
        strokeWidth={active ? 4 : 2}
      />
      <path
        d="M201 186C231 137 278 128 303 141C298 180 254 207 201 186Z"
        fill={active ? '#CAEAA4' : '#AFD98A'}
        stroke={active ? highlight : '#629751'}
        strokeWidth={active ? 4 : 2}
      />
      <path
        d="M200 99C211 61 248 45 270 52C266 79 242 103 200 99Z"
        fill={active ? '#CAEAA4' : '#AFD98A'}
        stroke={active ? highlight : '#629751'}
        strokeWidth={active ? 4 : 2}
      />
      <path
        d="M198 143L115 111M202 186L284 151M202 99L252 63"
        fill="none"
        stroke="#629751"
        strokeWidth="3"
        strokeLinecap="round"
        pointerEvents="none"
      />
    </>
  );
}
