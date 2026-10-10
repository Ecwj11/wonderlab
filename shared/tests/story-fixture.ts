export const storyLessonFixture = {
  lessonSchemaVersion: 1,
  title: '小雨的种子',
  subject: 'GENERAL',
  language: 'Chinese',
  objectives: ['理解故事并帮助小雨种花'],
  scenes: [
    {
      id: 'garden-story',
      type: 'INTERACTIVE_STORY',
      world: 'SCHOOL_GARDEN',
      title: '小雨的种子',
      explanation: '走进学校花园。',
      steps: [
        {
          id: 'meet',
          title: '认识小雨',
          text: '小雨想在花园种花。',
          narrationSrc: '/audio/stories/garden-story/meet.mp3',
          task: {
            type: 'MEET',
            prompt: '谁想种花？',
            choices: [
              { id: 'xiaoyu', label: '小雨', target: 'XIAOYU' },
              { id: 'amin', label: '阿明', target: 'AMIN' },
            ],
            correctChoiceId: 'xiaoyu',
            successText: '找到了小雨！',
            retryText: '再看看。',
          },
        },
        {
          id: 'question',
          title: '故事的问题',
          text: '花需要水和阳光。',
          narrationSrc: '/audio/stories/garden-story/question.mp3',
          task: {
            type: 'QUESTION',
            prompt: '花需要什么？',
            choices: [
              { id: 'water', label: '水' },
              { id: 'ball', label: '球' },
            ],
            correctChoiceId: 'water',
            successText: '答对了！',
            retryText: '再想一想。',
          },
        },
      ],
    },
  ],
};
