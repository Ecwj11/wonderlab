import type { PortalTemplate } from '@wonderlab/shared';

// Presentation stays in the frontend; the database stores only a validated template ID.
export const portalTemplates = {
  playground: {
    name: 'Learning playground',
    description: 'Bright skies, colorful learning worlds and a friendly reading owl.',
    colors: ['#34a5ff', '#ffd447', '#ff717f', '#70d29a', '#b584f6'],
    heroTitle: ['Big ideas.', 'Little adventures.'],
    heroDescription:
      'A pizza to slice. A heart to explore. Let’s turn your textbook into playtime.',
    badge: 'Welcome to the wonder club',
    speech: 'Curiosity is your superpower!',
    heroAsset: '/templates/playground-hero.png',
    previewAsset: '/templates/playground-preview.png',
  },
  space: {
    name: 'Space adventure',
    description: 'An astronaut owl, cosmic discoveries and a new mission every day.',
    colors: ['#211c50', '#49e1f3', '#9861e9', '#ffac62', '#ffda6a'],
    heroTitle: ['Ready for your', 'next mission?'],
    heroDescription:
      'Explore a new idea. Discover a new world. Your next learning mission starts here.',
    badge: 'Welcome aboard, explorer',
    speech: 'A universe of ideas awaits!',
    heroAsset: '/templates/space-hero.png',
    previewAsset: '/templates/space-preview.png',
  },
  clay: {
    name: 'Clay discovery',
    description: 'Soft clay characters, warm colors and hands-on discovery.',
    colors: ['#fff8ef', '#ff7960', '#f7d16e', '#b9dfad', '#abd4f3'],
    heroTitle: ['Small steps.', 'Big discoveries.'],
    heroDescription:
      'Big questions start with a little curiosity. Let’s make something wonderful together.',
    badge: 'A little discovery studio',
    speech: 'Small learners. Big possibilities.',
    heroAsset: '/templates/clay-hero.png',
    previewAsset: '/templates/clay-preview.png',
  },
} satisfies Record<
  PortalTemplate,
  {
    name: string;
    description: string;
    colors: string[];
    heroTitle: string[];
    heroDescription: string;
    badge: string;
    speech: string;
    heroAsset: string;
    previewAsset: string;
  }
>;

export const templateOrder: PortalTemplate[] = ['playground', 'space', 'clay'];
