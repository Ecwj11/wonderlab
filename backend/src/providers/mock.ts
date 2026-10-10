import {
  lessonSchema,
  type GenerateInput,
  type LessonDefinition,
  type Scene,
} from '@wonderlab/shared';
import type { AIProvider, Analysis, GenerationResult, SceneTaskContext } from './types.js';
export class MockAIProvider implements AIProvider {
  readonly name = 'mock';
  readonly model = 'wonderlab-demo-v1';
  async analyzeContent(input: GenerateInput): Promise<Analysis> {
    const content = (input.title + ' ' + input.content).toLowerCase();
    const family =
      input.subject === 'MATHEMATICS' && /fraction|pecahan|分数/.test(content)
        ? 'fractions'
        : input.subject === 'HISTORY' && /malaysia|merdeka|independence|tanah melayu/.test(content)
          ? 'history'
          : input.subject === 'SCIENCE' && /heart|jantung|心脏/.test(content)
            ? 'heart'
            : 'generic';
    return { family, objectives: [], concepts: [input.title] };
  }
  async generateLesson(input: GenerateInput, analysis: Analysis): Promise<GenerationResult> {
    let definition: LessonDefinition;
    if (analysis.family === 'fractions') definition = fractions(input);
    else if (analysis.family === 'history') definition = history(input);
    else if (analysis.family === 'heart') definition = heart(input);
    else definition = generic(input);
    return {
      definition: lessonSchema.parse(definition),
      usage: { tokensInput: 0, tokensOutput: 0, estimatedCost: 0 },
    };
  }
  async generateQuiz(input: GenerateInput) {
    const scene = (
      await this.generateLesson(input, await this.analyzeContent(input))
    ).definition.scenes.find((s): s is Extract<Scene, { type: 'QUIZ' }> => s.type === 'QUIZ');
    if (!scene)
      throw new Error(
        'This mock topic has no automatic quiz; configure a real provider for arbitrary quizzes.',
      );
    return scene;
  }
  async generateScene(input: GenerateInput, type: Scene['type']) {
    const scene = (
      await this.generateLesson(input, await this.analyzeContent(input))
    ).definition.scenes.find((s) => s.type === type);
    if (!scene) throw new Error('Scene type is not available for this mock topic.');
    return scene;
  }
  getUsage() {
    return { tokensInput: 0, tokensOutput: 0, estimatedCost: 0 };
  }
  async regenerateScene(_input: GenerateInput, scene: Scene, _context?: SceneTaskContext) {
    // Demo scene specialists operate on their own assigned draft, preserving IDs and type.
    return structuredClone(scene);
  }
}
const quizQuestion = (
  id: string,
  prompt: string,
  choices: string[],
  answer: number,
  explanation: string,
) => ({
  id,
  prompt,
  options: choices.map((label, i) => ({ id: String.fromCharCode(97 + i), label })),
  correctOptionId: String.fromCharCode(97 + answer),
  explanation,
});
function base(input: GenerateInput) {
  return {
    lessonSchemaVersion: 1 as const,
    title: input.title,
    subject: input.subject,
    language: input.language,
  };
}
function fractions(input: GenerateInput): LessonDefinition {
  const bm = input.language === 'Bahasa Melayu',
    zh = input.language === 'Chinese';
  const t = (en: string, ms: string, cn: string) => (zh ? cn : bm ? ms : en);
  return {
    ...base(input),
    objectives: [
      t('Recognize equal parts of a whole', 'Kenali bahagian sama besar', '认识整体的等分'),
      t(
        'Represent one quarter as 1/4',
        'Wakilkan satu perempat sebagai 1/4',
        '用 1/4 表示四分之一',
      ),
      t('Read the numerator and denominator', 'Baca pengangka dan penyebut', '理解分子与分母'),
    ],
    scenes: [
      {
        id: 'pizza',
        type: 'FRACTION_PIZZA',
        title: t('A little slice of maths', 'Sedikit potongan matematik', '一小块数学'),
        explanation: t(
          'A fraction is part of a whole. The denominator tells you how many equal parts the whole has. The numerator tells you how many parts you selected.',
          'Pecahan ialah sebahagian daripada keseluruhan. Penyebut menunjukkan jumlah bahagian sama besar. Pengangka menunjukkan bahagian yang dipilih.',
          '分数表示整体的一部分。分母表示整体被等分成几份，分子表示选择了几份。',
        ),
        instructions: t(
          'Divide the pizza into 4 equal slices. Then take one quarter.',
          'Bahagikan piza kepada 4 bahagian sama besar. Pilih satu perempat.',
          '将比萨等分成 4 份，再选择四分之一。',
        ),
        parts: 4,
        target: 1,
      },
      {
        id: 'fractions-review',
        type: 'FLASHCARD',
        title: t(
          'Meet the numerator & denominator',
          'Kenali pengangka dan penyebut',
          '认识分子与分母',
        ),
        explanation: t(
          'Flip each card to discover what makes a fraction.',
          'Terbalikkan kad untuk memahami pecahan.',
          '翻开每张卡片，了解分数。',
        ),
        cards: [
          {
            id: 'numerator',
            front: t(
              'What does the top number tell us?',
              'Apakah maksud nombor di atas?',
              '上面的数字表示什么？',
            ),
            back: t(
              'The numerator counts the parts selected. In 1/4, we selected 1 slice.',
              'Pengangka mengira bahagian yang dipilih. Dalam 1/4, kita memilih 1 bahagian.',
              '分子表示选中的份数。1/4 中选中了 1 份。',
            ),
          },
          {
            id: 'denominator',
            front: t(
              'What does the bottom number tell us?',
              'Apakah maksud nombor di bawah?',
              '下面的数字表示什么？',
            ),
            back: t(
              'The denominator counts all equal parts. In 1/4, the whole has 4 equal slices.',
              'Penyebut mengira semua bahagian sama besar. Dalam 1/4, ada 4 bahagian.',
              '分母表示等分的总份数。1/4 中整体被等分成 4 份。',
            ),
          },
        ],
      },
      {
        id: 'fractions-quiz',
        type: 'QUIZ',
        title: t('You know your slices!', 'Uji kefahaman pecahan!', '检验你的分数知识！'),
        explanation: t(
          'Put your fraction skills to the test.',
          'Uji kemahiran pecahan anda.',
          '测试你的分数技能。',
        ),
        questions: [
          quizQuestion(
            'q1',
            t(
              'One of four equal slices is…',
              'Satu daripada empat bahagian sama besar ialah…',
              '四等份中的一份是……',
            ),
            ['1/4', '1/2', '3/4', '4/4'],
            0,
            t(
              'One selected slice out of four is one quarter.',
              'Satu daripada empat ialah satu perempat.',
              '四份中选择一份，就是四分之一。',
            ),
          ),
          quizQuestion(
            'q2',
            t('What does the denominator tell you?', 'Apakah maksud penyebut?', '分母表示什么？'),
            [
              t('Selected parts', 'Bahagian dipilih', '选中的份数'),
              t('Total equal parts', 'Jumlah bahagian sama besar', '等分的总份数'),
              t('Pizza toppings', 'Hiasan piza', '比萨配料'),
            ],
            1,
            t(
              'The denominator is the total number of equal parts.',
              'Penyebut ialah jumlah bahagian sama besar.',
              '分母表示整体被等分成的总份数。',
            ),
          ),
          quizQuestion(
            'q3',
            t(
              'You select 3 out of 8 equal slices. Which fraction is this?',
              'Anda memilih 3 daripada 8 bahagian. Apakah pecahannya?',
              '从 8 等份中选择 3 份，是什么分数？',
            ),
            ['8/3', '1/8', '3/8', '3/4'],
            2,
            t(
              'Three selected parts over eight total parts gives 3/8.',
              'Tiga daripada lapan ialah 3/8.',
              '8 份中选择 3 份，就是 3/8。',
            ),
          ),
        ],
      },
    ],
  };
}
function history(input: GenerateInput): LessonDefinition {
  const bm = input.language === 'Bahasa Melayu';
  const t = (en: string, ms: string) => (bm ? ms : en);
  return {
    ...base(input),
    objectives: [
      t(
        'Explore the journey to Malayan independence',
        'Terokai perjalanan kemerdekaan Tanah Melayu',
      ),
      t('Identify the date of independence', 'Kenali tarikh kemerdekaan'),
      t(
        'Distinguish Malayan independence from the formation of Malaysia',
        'Bezakan kemerdekaan Tanah Melayu dan pembentukan Malaysia',
      ),
    ],
    scenes: [
      {
        id: 'merdeka-timeline',
        type: 'TIMELINE',
        title: t('The road to independence', 'Jalan menuju kemerdekaan'),
        explanation: t(
          'Explore five turning points that shaped the nation.',
          'Terokai lima peristiwa penting yang membentuk negara.',
        ),
        instructions: t(
          'Select every year to explore its people, place and story.',
          'Pilih setiap tahun untuk menerokai tokoh, lokasi dan ceritanya.',
        ),
        events: [
          {
            id: 'e1941',
            year: 1941,
            title: t('Japanese occupation begins', 'Pendudukan Jepun bermula'),
            description: t(
              'Japanese forces landed in Kota Bharu in December 1941, beginning the invasion of Malaya. The occupation brought major hardship.',
              'Tentera Jepun mendarat di Kota Bharu pada Disember 1941, memulakan serangan ke Tanah Melayu. Pendudukan ini membawa kesusahan besar.',
            ),
            location: 'Kota Bharu, Kelantan',
            people: [],
          },
          {
            id: 'e1945',
            year: 1945,
            title: t('End of World War II', 'Tamat Perang Dunia Kedua'),
            description: t(
              'Japan surrendered in August 1945. British administration returned, and calls for self-government grew.',
              'Jepun menyerah kalah pada Ogos 1945. Pentadbiran British kembali dan tuntutan pemerintahan sendiri meningkat.',
            ),
            location: 'Tanah Melayu',
            people: [],
          },
          {
            id: 'e1955',
            year: 1955,
            title: t('First Federal Election', 'Pilihan Raya Persekutuan pertama'),
            description: t(
              'The Alliance won 51 of 52 elected seats. Tunku Abdul Rahman became Chief Minister and led negotiations for independence.',
              'Parti Perikatan memenangi 51 daripada 52 kerusi yang dipertandingkan. Tunku Abdul Rahman menjadi Ketua Menteri dan mengetuai rundingan kemerdekaan.',
            ),
            location: 'Kuala Lumpur',
            people: ['Tunku Abdul Rahman'],
          },
          {
            id: 'e1957',
            year: 1957,
            title: t('Merdeka!', 'Merdeka!'),
            description: t(
              'On 31 August 1957, the Federation of Malaya became independent. At Stadium Merdeka, Tunku Abdul Rahman proclaimed independence.',
              'Pada 31 Ogos 1957, Persekutuan Tanah Melayu mencapai kemerdekaan. Tunku Abdul Rahman mengisytiharkan kemerdekaan di Stadium Merdeka.',
            ),
            location: 'Stadium Merdeka, Kuala Lumpur',
            people: ['Tunku Abdul Rahman'],
          },
          {
            id: 'e1963',
            year: 1963,
            title: t('Formation of Malaysia', 'Pembentukan Malaysia'),
            description: t(
              'On 16 September 1963, Malaya, Sabah, Sarawak and Singapore formed Malaysia. Singapore left in 1965.',
              'Pada 16 September 1963, Tanah Melayu, Sabah, Sarawak dan Singapura membentuk Malaysia. Singapura keluar pada 1965.',
            ),
            location: 'Malaysia',
            people: ['Tunku Abdul Rahman'],
          },
        ],
      },
      {
        id: 'merdeka-quiz',
        type: 'QUIZ',
        title: t('A moment in history', 'Detik bersejarah'),
        explanation: t('Check your discoveries.', 'Uji pengetahuan anda.'),
        questions: [
          quizQuestion(
            'q1',
            t(
              'On what date did Malaya achieve independence?',
              'Pada tarikh berapakah Tanah Melayu mencapai kemerdekaan?',
            ),
            ['31 Ogos 1955', '31 Ogos 1957', '16 September 1963', '1 Januari 1957'],
            1,
            t(
              'Malaya achieved independence on 31 August 1957.',
              'Tanah Melayu mencapai kemerdekaan pada 31 Ogos 1957.',
            ),
          ),
          quizQuestion(
            'q2',
            t('Where was independence proclaimed?', 'Di manakah kemerdekaan diisytiharkan?'),
            ['Kota Bharu', 'Stadium Merdeka', 'Pulau Pinang'],
            1,
            t(
              'The proclamation was held at Stadium Merdeka in Kuala Lumpur.',
              'Pengisytiharan berlangsung di Stadium Merdeka, Kuala Lumpur.',
            ),
          ),
        ],
      },
    ],
  };
}
function heart(input: GenerateInput): LessonDefinition {
  const parts = [
    {
      id: 'right-atrium',
      label: 'Right atrium',
      description: 'Receives oxygen-poor blood returning from the body.',
    },
    {
      id: 'right-ventricle',
      label: 'Right ventricle',
      description: 'Pumps oxygen-poor blood to the lungs to pick up oxygen.',
    },
    {
      id: 'left-atrium',
      label: 'Left atrium',
      description: 'Receives oxygen-rich blood coming back from the lungs.',
    },
    {
      id: 'left-ventricle',
      label: 'Left ventricle',
      description: 'Pumps oxygen-rich blood to the rest of the body.',
    },
  ];
  return {
    ...base(input),
    objectives: [
      'Identify the four chambers of the heart',
      'Trace blood circulation through the heart and lungs',
    ],
    scenes: [
      {
        id: 'heart-explore',
        type: 'INTERACTIVE_DIAGRAM',
        diagram: 'HEART',
        title: 'A beat of discovery',
        explanation:
          'Your heart is a muscle with four chambers. Its right side sends blood to the lungs; its left side sends blood to your body.',
        instructions: 'Select all four chambers to discover what each one does.',
        parts,
      },
      {
        id: 'heart-flow',
        type: 'ANIMATION',
        diagram: 'HEART',
        title: 'Follow the flow',
        explanation:
          'Body → right atrium → right ventricle → lungs → left atrium → left ventricle → body. Blue represents oxygen-poor blood; red represents oxygen-rich blood.',
        instructions: 'Follow the blood, then select each chamber.',
        parts,
      },
      {
        id: 'heart-quiz',
        type: 'QUIZ',
        title: 'A heart-smart challenge',
        explanation: 'Use what you discovered.',
        questions: [
          quizQuestion(
            'q1',
            'How many chambers does the human heart have?',
            ['Two', 'Three', 'Four', 'Five'],
            2,
            'The heart has two atria and two ventricles: four chambers.',
          ),
          quizQuestion(
            'q2',
            'Which chamber pumps oxygen-rich blood to the body?',
            ['Right atrium', 'Left ventricle', 'Right ventricle'],
            1,
            'The left ventricle pumps oxygen-rich blood around the body.',
          ),
        ],
      },
    ],
  };
}
function generic(input: GenerateInput): LessonDefinition {
  const paragraphs = input.content
    .split(/\n\s*\n|(?<=[.!?])\s+/)
    .filter(Boolean)
    .map((p) => p.slice(0, 1900))
    .slice(0, 8);
  return {
    ...base(input),
    objectives: ['Explore the supplied material', 'Explain one key idea in your own words'],
    scenes: [
      {
        id: 'explore',
        type: 'STORY',
        title: 'Explore your ideas',
        explanation:
          'This guided demo uses your source material. A connected AI provider can turn other topics into tailored simulations and quizzes.',
        paragraphs: paragraphs.length ? paragraphs : [input.title],
      },
      {
        id: 'reflect',
        type: 'FLASHCARD',
        title: 'Make it stick',
        explanation: 'Flip the cards and explain the ideas aloud.',
        cards: paragraphs.slice(0, 4).map((p, i) => ({
          id: 'idea-' + i,
          front: 'What can you explain about idea ' + (i + 1) + '?',
          back: p,
        })),
      },
    ],
  };
}
