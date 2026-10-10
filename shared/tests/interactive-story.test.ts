import { describe, expect, it } from 'vitest';
import { lessonSchema, publicDefinition, publicLessonSchema } from '../src/lesson-schema.js';
import { storyLessonFixture } from './story-fixture.js';
const copy = () => structuredClone(storyLessonFixture);
describe('Narrated interactive story contract', () => {
  it('accepts the additive schema version 1 story renderer', () => {
    expect(lessonSchema.safeParse(storyLessonFixture).success).toBe(true);
  });
  it('redacts answers and feedback from every public story step', () => {
    const definition = publicDefinition(lessonSchema.parse(storyLessonFixture));
    expect(publicLessonSchema.safeParse(definition).success).toBe(true);
    expect(JSON.stringify(definition)).not.toMatch(/correctChoiceId|successText|retryText/);
    expect(definition.scenes[0]).toMatchObject({ world: 'SCHOOL_GARDEN' });
  });
  it.each([
    'https://example.com/audio.mp3',
    '//example.com/audio.mp3',
    '/audio/stories/a/../b.mp3',
    '/audio/stories/a/%2e%2e.mp3',
    '/audio/stories/a/a.mp3?code=1',
    '/audio/stories/a/<script>.mp3',
    'javascript:alert(1)',
    '/audio/stories/a/a.html',
    '/audio/stories/a/a\\b.mp3',
  ])('rejects unsafe narration paths: %s', (path) => {
    const lesson = copy();
    lesson.scenes[0].steps[0].narrationSrc = path;
    expect(lessonSchema.safeParse(lesson).success).toBe(false);
  });
  it('rejects ambiguous or incomplete story tasks', () => {
    const invalids = [
      (l: ReturnType<typeof copy>) => {
        l.scenes[0].steps[1].id = 'meet';
      },
      (l: ReturnType<typeof copy>) => {
        l.scenes[0].steps[0].task.choices[1].id = 'xiaoyu';
      },
      (l: ReturnType<typeof copy>) => {
        l.scenes[0].steps[0].task.choices[1].target = 'XIAOYU';
      },
      (l: ReturnType<typeof copy>) => {
        delete l.scenes[0].steps[0].task.choices[0].target;
      },
      (l: ReturnType<typeof copy>) => {
        l.scenes[0].steps[1].task.choices[0].target = 'SUN';
      },
      (l: ReturnType<typeof copy>) => {
        l.scenes[0].steps[0].task.correctChoiceId = 'missing';
      },
      (l: ReturnType<typeof copy>) => {
        l.scenes[0].steps = l.scenes[0].steps.slice(0, 1);
      },
      (l: ReturnType<typeof copy>) => {
        l.scenes[0].steps[0].text = 'a'.repeat(2001);
      },
      (l: ReturnType<typeof copy>) => {
        l.scenes[0].steps[0].task.prompt = '';
      },
    ];
    for (const invalidate of invalids) {
      const lesson = copy();
      invalidate(lesson);
      expect(lessonSchema.safeParse(lesson).success).toBe(false);
    }
  });
});
