'use client';
import { LocalizedText, useI18n } from '@/components/i18n';
import { useState, useEffect } from 'react';
import { MapPin, Users, Check, Flag } from 'lucide-react';
import type { PublicScene } from '@wonderlab/shared';
import { LessonArt } from '../art';
import type { SceneProps } from './types';
export function TimelineScene({
  scene,
  onChange,
}: SceneProps<Extract<PublicScene, { type: 'TIMELINE' }>>) {
  const { t } = useI18n();

  const [selected, setSelected] = useState(scene.events[0]);
  const [viewed, setViewed] = useState<string[]>([scene.events[0].id]);
  useEffect(() => {
    onChange(viewed.length === scene.events.length ? { viewedIds: viewed } : null);
  }, [viewed, scene.events.length, onChange]);
  const select = (event: typeof selected) => {
    setSelected(event);
    setViewed((old) => (old.includes(event.id) ? old : [...old, event.id]));
  };
  return (
    <div className="timeline-scene">
      <span className="stage-prompt">{scene.instructions}</span>
      <div className="timeline-track">
        {scene.events.map((event) => (
          <button
            key={event.id}
            className={selected.id === event.id ? 'active' : ''}
            onClick={() => select(event)}
          >
            <span className="timeline-dot">
              {viewed.includes(event.id) ? <Check size={12} /> : <span />}
            </span>
            <strong>{event.year}</strong>
            <small>{event.title}</small>
          </button>
        ))}
      </div>
      <div className="timeline-event" key={selected.id}>
        <div className="timeline-art">
          <LessonArt kind="history" />
          <span className="event-year">{selected.year}</span>
          <div className="mini-map">
            <svg viewBox="0 0 180 150" aria-label={t('Schematic map of Peninsular Malaysia')}>
              <path
                d="M70 10l20 8 13 17-1 23 18 19 8 26 13 22-11 9-24-10-17-21-12-11-4-28-12-18-9-17z"
                fill="#C8DDC3"
                stroke="#ACC8A4"
                strokeWidth="2"
              />
              <circle
                cx={selected.year === 1941 ? 94 : 88}
                cy={selected.year === 1941 ? 39 : 91}
                r="5"
                fill="#CB9A78"
              />
              <circle
                cx={selected.year === 1941 ? 94 : 88}
                cy={selected.year === 1941 ? 39 : 91}
                r="10"
                stroke="#D8B79A"
                strokeDasharray="2 3"
              />
              <text x="12" y="143" fill="#A0B599" fontSize="9">
                {t('Peninsular Malaysia · schematic')}
              </text>
            </svg>
          </div>
        </div>
        <div className="timeline-story">
          <span className="subject-tag peach">
            <Flag size={12} />
            {selected.year}
          </span>
          <h3>{selected.title}</h3>
          <p>{selected.description}</p>
          <div className="event-location">
            <MapPin size={16} />
            {selected.location}
          </div>
          {selected.people.length > 0 && (
            <div className="event-location">
              <Users size={16} />
              {selected.people.join(', ')}
            </div>
          )}
          <span className="exploration-count">
            <LocalizedText text={`${viewed.length} of ${scene.events.length} moments explored`} />
          </span>
          {viewed.length === scene.events.length && (
            <div className="activity-success">
              <Check size={15} />
              <LocalizedText text="You’ve explored the whole journey." />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
