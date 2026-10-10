'use client';
import type { ComponentType } from 'react';
import { MatchingGameScene } from './games';
import { ForestScene } from './forest';
import { SubjectAdventureScene } from './subject-adventure';
import { QuizScene } from './quiz';
import { InteractiveStoryScene } from './interactive-story';
import { FractionScene } from './fraction';
import { TimelineScene } from './timeline';
import { DiagramScene } from './diagram';
import { FlashcardScene, StoryScene } from './reading';
import type { PublicScene } from '@wonderlab/shared';
import type { SceneProps } from './types';
export const interactionRegistry: Partial<Record<PublicScene['type'], ComponentType<SceneProps>>> =
  {
    INTERACTIVE_STORY: ({ scene, ...props }) =>
      scene.type === 'INTERACTIVE_STORY' ? (
        <InteractiveStoryScene scene={scene} {...props} />
      ) : null,
    NUMBER_GAME: ({ scene, ...props }) =>
      scene.type === 'NUMBER_GAME' ? <ForestScene scene={scene} {...props} /> : null,
    MATCHING: ({ scene, ...props }) =>
      scene.type === 'MATCHING' ? (
        scene.gameStyle === 'MEMORY' ||
        (props.subject === 'MATHEMATICS' && scene.gameStyle !== 'ADVENTURE') ? (
          <MatchingGameScene scene={scene} {...props} />
        ) : (
          <SubjectAdventureScene scene={scene} {...props} />
        )
      ) : null,
    QUIZ: ({ scene, ...props }) =>
      scene.type === 'QUIZ' ? <QuizScene scene={scene} {...props} /> : null,
    FRACTION_PIZZA: ({ scene, ...props }) =>
      scene.type === 'FRACTION_PIZZA' ? <FractionScene scene={scene} {...props} /> : null,
    TIMELINE: ({ scene, ...props }) =>
      scene.type === 'TIMELINE' ? <TimelineScene scene={scene} {...props} /> : null,
    INTERACTIVE_DIAGRAM: ({ scene, ...props }) =>
      scene.type === 'INTERACTIVE_DIAGRAM' ? <DiagramScene scene={scene} {...props} /> : null,
    ANIMATION: ({ scene, ...props }) =>
      scene.type === 'ANIMATION' ? <DiagramScene scene={scene} {...props} /> : null,
    FLASHCARD: ({ scene, ...props }) =>
      scene.type === 'FLASHCARD' ? <FlashcardScene scene={scene} {...props} /> : null,
    STORY: ({ scene, ...props }) =>
      scene.type === 'STORY' ? <StoryScene scene={scene} {...props} /> : null,
  };
