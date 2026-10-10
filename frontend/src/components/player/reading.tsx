'use client';
import { LocalizedText } from '@/components/i18n';
import { useState, useEffect } from 'react';
import { RotateCcw, Check, BookOpen } from 'lucide-react';
import type { PublicScene } from '@wonderlab/shared';
import type { SceneProps } from './types';
export function FlashcardScene({
  scene,
  onChange,
}: SceneProps<Extract<PublicScene, { type: 'FLASHCARD' }>>) {
  const [flipped, setFlipped] = useState<string[]>([]);
  const [viewed, setViewed] = useState<string[]>([]);
  useEffect(() => {
    onChange(viewed.length === scene.cards.length ? { viewedIds: viewed } : null);
  }, [viewed, scene.cards.length, onChange]);
  return (
    <div className="flashcard-scene">
      <span className="stage-prompt">{scene.explanation}</span>
      <div className="flashcards">
        {scene.cards.map((card, i) => (
          <button
            key={card.id}
            className={'flashcard ' + (flipped.includes(card.id) ? 'flipped' : '')}
            onClick={() => {
              setFlipped((old) =>
                old.includes(card.id) ? old.filter((id) => id !== card.id) : [...old, card.id],
              );
              setViewed((old) => (old.includes(card.id) ? old : [...old, card.id]));
            }}
          >
            <span className="flashcard-number">{String(i + 1).padStart(2, '0')}</span>
            <strong>{flipped.includes(card.id) ? card.back : card.front}</strong>
            <span className="flip-hint">
              <RotateCcw size={13} />
              <LocalizedText text="Click to" />
              <LocalizedText
                text={flipped.includes(card.id) ? 'see the question' : 'discover the answer'}
              />
            </span>
          </button>
        ))}
      </div>
      {viewed.length === scene.cards.length && (
        <div className="activity-success">
          <Check size={16} />
          <LocalizedText text="A little clearer? You’re ready to move on." />
        </div>
      )}
    </div>
  );
}
export function StoryScene({
  scene,
  onChange,
}: SceneProps<Extract<PublicScene, { type: 'STORY' }>>) {
  const [read, setRead] = useState(false);
  useEffect(() => {
    onChange(read ? { viewed: true } : null);
  }, [read, onChange]);
  return (
    <div className="story-scene">
      <span className="story-icon">
        <BookOpen size={28} />
      </span>
      <h3>{scene.title}</h3>
      {scene.paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <button
        className={'button ' + (read ? 'secondary' : 'primary')}
        onClick={() => setRead(true)}
      >
        <Check size={16} />
        <LocalizedText
          text={read ? 'I’ve explored these ideas' : 'I’ve explored this. Let’s reflect.'}
        />
      </button>
    </div>
  );
}
