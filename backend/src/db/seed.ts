import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { type GenerateInput } from '@wonderlab/shared';
import { pool, rows, run, transaction } from './pool.js';
import { config } from '../config.js';
import { seedRewardPrizes } from './reward-seed.js';
import { MockAIProvider } from '../providers/mock.js';
export const seedIds = {
  student: '10000000-0000-4000-8000-000000000001',
  teacher: '10000000-0000-4000-8000-000000000002',
  admin: '10000000-0000-4000-8000-000000000003',
};
export async function seed() {
  if (config.NODE_ENV === 'production') throw new Error('Demo seeding is disabled in production');
  for (const role of ['STUDENT', 'PARENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN'])
    await run('INSERT IGNORE INTO roles(id,name) VALUES(?,?)', [role, role]);
  for (const [id, name, color] of [
    ['MATHEMATICS', 'Mathematics', 'coral'],
    ['SCIENCE', 'Science', 'mint'],
    ['HISTORY', 'History', 'peach'],
    ['GEOGRAPHY', 'Geography', 'blue'],
    ['GENERAL', 'General', 'violet'],
  ])
    await run('INSERT IGNORE INTO subjects(id,name,color) VALUES(?,?,?)', [id, name, color]);
  const passwordHash = await bcrypt.hash('qwer1234!', 12);
  for (const [kind, name, email, role] of [
    ['student', 'Alex Tan', 'student@example.com', 'STUDENT'],
    ['teacher', 'Sarah Lim', 'teacher@example.com', 'TEACHER'],
    ['admin', 'Wonderlab Admin', 'admin@example.com', 'ADMIN'],
  ] as const) {
    const id = seedIds[kind];
    await run('INSERT IGNORE INTO users(id,name,email,password_hash) VALUES(?,?,?,?)', [
      id,
      name,
      email,
      passwordHash,
    ]);
    await run('INSERT IGNORE INTO user_roles(user_id,role_id) VALUES(?,?)', [id, role]);
  }
  const provider = new MockAIProvider();
  const seeds: GenerateInput[] = [
    {
      title: 'Fractions made delicious',
      subject: 'MATHEMATICS',
      language: 'English',
      schoolLevel: 'Primary 4–6',
      inputType: 'TEXT',
      content: 'Fractions are equal parts of a whole. One quarter is one of four equal parts.',
    },
    {
      title: 'The incredible human heart',
      subject: 'SCIENCE',
      language: 'English',
      schoolLevel: 'Primary 5–6',
      inputType: 'TEXT',
      content: 'The human heart has four chambers. Blood travels to the lungs and the body.',
    },
    {
      title: 'The road to Merdeka',
      subject: 'HISTORY',
      language: 'Bahasa Melayu',
      schoolLevel: 'Secondary 1–3',
      inputType: 'TEXT',
      content:
        'Kemerdekaan Tanah Melayu pada 31 Ogos 1957. Malaysia dibentuk pada 16 September 1963.',
    },
    {
      title: 'Our cosmic neighbourhood',
      subject: 'SCIENCE',
      language: 'English',
      schoolLevel: 'Primary 4–6',
      inputType: 'TEXT',
      content:
        'The solar system includes the Sun and eight planets. Earth is the third planet from the Sun. Gravity keeps the planets in orbit.',
    },
  ];
  for (let i = 0; i < seeds.length; i++) {
    const input = seeds[i];
    const { definition } = await provider.generateLesson(
      input,
      await provider.analyzeContent(input),
    );
    if (i === 3)
      definition.scenes = [
        {
          id: 'solar-explore',
          type: 'INTERACTIVE_DIAGRAM',
          diagram: 'SOLAR_SYSTEM',
          title: 'Your place in space',
          explanation: 'The Sun is at the centre of our solar system. Eight planets orbit it.',
          instructions: 'Select each planet to discover your cosmic neighbours.',
          parts: [
            {
              id: 'mercury',
              label: 'Mercury',
              description: 'The smallest planet and the closest to the Sun.',
            },
            {
              id: 'venus',
              label: 'Venus',
              description: 'The hottest planet, with a thick atmosphere.',
            },
            { id: 'earth', label: 'Earth', description: 'Our home, with liquid water and life.' },
            { id: 'mars', label: 'Mars', description: 'The red planet, with a thin atmosphere.' },
          ],
        },
      ];
    for (const [owner, visibility, prefix] of [
      [seedIds.teacher, 'PUBLIC', '20000000'],
      [seedIds.student, 'PRIVATE', '30000000'],
    ] as const) {
      const id = prefix + '-0000-4000-8000-' + String(i + 1).padStart(12, '0');
      if ((await rows('SELECT id FROM lessons WHERE id=?', [id])).length) continue;
      await transaction(async (db) => {
        await run(
          "INSERT INTO lessons(id,user_id,title,subject_id,language,school_level,visibility,status,source_content,input_type) VALUES(?,?,?,?,?,?,?,'READY',?,?)",
          [
            id,
            owner,
            input.title,
            input.subject,
            input.language,
            input.schoolLevel,
            visibility,
            input.content,
            input.inputType,
          ],
          db,
        );
        const versionId = randomUUID();
        await run(
          'INSERT INTO lesson_versions(id,lesson_id,version,definition) VALUES(?,?,1,?)',
          [versionId, id, JSON.stringify(definition)],
          db,
        );
        for (const [position, scene] of definition.scenes.entries())
          await run(
            'INSERT INTO lesson_scenes(id,lesson_version_id,scene_key,scene_type,position) VALUES(?,?,?,?,?)',
            [randomUUID(), versionId, scene.id, scene.type, position],
            db,
          );
        if (owner === seedIds.student && i === 1) {
          await run(
            'INSERT INTO lesson_progress(id,user_id,lesson_id,progress,learning_seconds) VALUES(?,?,?,33,180)',
            [randomUUID(), owner, id],
            db,
          );
          await run(
            'INSERT INTO scene_progress(id,user_id,lesson_id,scene_key) VALUES(?,?,?,?)',
            [randomUUID(), owner, id, 'heart-explore'],
            db,
          );
        }
      });
    }
  }
  for (const [id, name, description, icon, threshold] of [
    ['first-lesson', 'First discovery', 'Complete your first lesson', 'compass', 1],
    ['five-lessons', 'Curious explorer', 'Complete five lessons', 'rocket', 5],
    ['perfect-quiz', 'Quiz whiz', 'Get a perfect quiz score', 'star', 100],
    ['three-days', 'On a roll', 'Learn for three days in a row', 'flame', 3],
    ['thousand-xp', 'Bright spark', 'Earn 1,000 XP', 'zap', 1000],
  ])
    await run(
      'INSERT IGNORE INTO achievements(id,name,description,icon,threshold) VALUES(?,?,?,?,?)',
      [id, name, description, icon, threshold],
    );
}
export async function seedFamilies() {
  if (config.NODE_ENV === 'production') throw new Error('Demo seeding is disabled in production');
  const parentId = '10000000-0000-4000-8000-000000000004';
  const childId = '10000000-0000-4000-8000-000000000005';
  const familyId = '50000000-0000-4000-8000-000000000001';
  const passwordHash = await bcrypt.hash('qwer1234!', 12);
  const passcodeHash = await bcrypt.hash('qwer1234!', 12);
  await transaction(async (db) => {
    for (const role of ['PARENT', 'STUDENT'])
      await run('INSERT IGNORE INTO roles(id,name) VALUES(?,?)', [role, role], db);
    await run(
      'INSERT IGNORE INTO users(id,name,email,password_hash) VALUES(?,?,?,?)',
      [parentId, 'Wonderlab Parent', 'parent@example.com', passwordHash],
      db,
    );
    await run("INSERT IGNORE INTO user_roles(user_id,role_id) VALUES(?,'PARENT')", [parentId], db);
    await run(
      'INSERT IGNORE INTO families(id,parent_id,name,code,trial_started_at,trial_ends_at,trial_child_limit,trial_generation_limit) VALUES(?,?,?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)+INTERVAL 14 DAY,2,20)',
      [familyId, parentId, 'Wonderlab Family', 'WONDER01'],
      db,
    );
    await run(
      'INSERT IGNORE INTO users(id,name,email,password_hash) VALUES(?,?,?,?)',
      [childId, 'Alex', childId + '@child.wonderlab.invalid', passcodeHash],
      db,
    );
    await run("INSERT IGNORE INTO user_roles(user_id,role_id) VALUES(?,'STUDENT')", [childId], db);
    await run(
      'INSERT IGNORE INTO family_children(user_id,family_id,username,school_level,avatar,can_generate,allowed_subjects,daily_minutes_limit) VALUES(?,?,?,? ,?,?,?,?)',
      [
        childId,
        familyId,
        'alex',
        'Primary 4',
        'fox',
        false,
        JSON.stringify(['MATHEMATICS', 'SCIENCE', 'HISTORY', 'GEOGRAPHY', 'GENERAL']),
        30,
      ],
      db,
    );
  });
  await seedRewardPrizes();
}
if (process.argv[1]?.endsWith('/seed.ts') || process.argv[1]?.endsWith('/seed.js'))
  seed()
    .then(() => {
      console.log('Seeded three accounts and eight demo lessons.');
      return pool.end();
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
      pool.end();
    });
