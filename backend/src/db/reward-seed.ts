import { rewardInputSchema } from '@wonderlab/shared';
import { config } from '../config.js';
import { pool, rows, run, transaction } from './pool.js';

// Stable IDs make this safe to rerun without replacing parents' edits.
const familyId = '50000000-0000-4000-8000-000000000001';
export async function seedRewardPrizes() {
  if (config.NODE_ENV === 'production') throw new Error('Demo seeding is disabled in production');
  if (!(await rows('SELECT id FROM families WHERE id=? AND code=?', [familyId, 'WONDER01'])).length)
    throw new Error('Create the Wonderlab demo family before seeding prizes.');
  const samples = [
    {
      name: 'A new storybook',
      description: 'Choose a storybook together at the bookshop.',
      emoji: '📚',
      imageKey: 'storybook',
      starCost: 20,
    },
    {
      name: 'A favourite family meal',
      description: 'Enjoy a meal together and choose your favourite dish with your parent.',
      emoji: '🍕',
      imageKey: 'family-meal',
      starCost: 40,
    },
    {
      name: 'A little toy set',
      description: 'Choose a small toy or building-block set together with your parent.',
      emoji: '🧸',
      imageKey: 'toy-set',
      starCost: 60,
    },
  ];
  await transaction(async (db) => {
    for (const [index, sample] of samples.entries()) {
      const prize = rewardInputSchema.parse({ ...sample, childId: null, isActive: true });
      const id = '60000000-0000-4000-8000-' + String(index + 1).padStart(12, '0');
      await run(
        'INSERT IGNORE INTO family_rewards(id,family_id,name,description,emoji,image_key,star_cost,child_id,is_active) VALUES(?,?,?,?,?,?,?,NULL,TRUE)',
        [id, familyId, prize.name, prize.description, prize.emoji, prize.imageKey, prize.starCost],
        db,
      );
    }
  });
}
if (process.argv[1]?.endsWith('/reward-seed.ts') || process.argv[1]?.endsWith('/reward-seed.js'))
  seedRewardPrizes()
    .then(() => {
      console.log('Seeded illustrated book, meal and toy prizes for WONDER01.');
      return pool.end();
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
      return pool.end();
    });
