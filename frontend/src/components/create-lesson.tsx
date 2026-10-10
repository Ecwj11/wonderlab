'use client';
import { LocalizedText, useI18n } from '@/components/i18n';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Upload,
  ImageIcon,
  Lightbulb,
  Sparkles,
  ArrowRight,
  Check,
  LoaderCircle,
  ArrowLeft,
  Atom,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  subjects,
  subjectLabels,
  languages,
  type Subject,
  type Language,
  type GenerationJob,
} from '@wonderlab/shared';
import { api } from '@/lib/api';
import { useSession } from '@/components/session';
import { ProgressBar, Loading } from '@/components/ui';
import { Mascot } from '@/components/art';
const examples = [
  {
    title: 'Fractions made delicious',
    subject: 'MATHEMATICS' as Subject,
    language: 'English' as Language,
    content:
      'Fractions represent equal parts of a whole. The denominator shows the total number of equal parts. The numerator shows how many parts are selected. One quarter means one of four equal parts, written as 1/4.',
  },
  {
    title: 'The incredible human heart',
    subject: 'SCIENCE' as Subject,
    language: 'English' as Language,
    content:
      'The human heart has four chambers: the right atrium, right ventricle, left atrium and left ventricle. The right side sends blood to the lungs. The left side sends oxygen-rich blood to the body.',
  },
  {
    title: 'Kemerdekaan Tanah Melayu',
    subject: 'HISTORY' as Subject,
    language: 'Bahasa Melayu' as Language,
    content:
      'Kemerdekaan Tanah Melayu dicapai pada 31 Ogos 1957. Pendudukan Jepun bermula pada 1941 dan tamat pada 1945. Pilihan Raya Persekutuan pertama diadakan pada 1955. Malaysia dibentuk pada 16 September 1963.',
  },
];
export function CreateLesson() {
  const { user } = useSession();
  const parent = user?.accountType === 'PARENT';
  const lessonList = parent ? '/parent/lessons' : '/app/lessons';
  const { t } = useI18n();

  const router = useRouter();
  const [mode, setMode] = useState<'TEXT' | 'PDF' | 'IMAGE' | 'TOPIC'>('TEXT');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<Subject>('MATHEMATICS');
  const [language, setLanguage] = useState<Language>('English');
  const [schoolLevel, setSchoolLevel] = useState('Primary 4–6');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [upload, setUpload] = useState<{ id: string; name: string; content: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [jobId, setJobId] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const current = await api<GenerationJob>('/generation-jobs/' + jobId);
        if (cancelled) return;
        setJob(current);
        if (current.status === 'COMPLETED') {
          timer = setTimeout(
            () => router.push(parent ? lessonList : '/app/lesson/' + current.lessonId),
            1000,
          );
        } else if (!['FAILED', 'CANCELLED'].includes(current.status)) timer = setTimeout(poll, 800);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Unable to check generation progress.');
          timer = setTimeout(poll, 3000);
        }
      }
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId, router, parent, lessonList]);
  const uploadFile = async (file?: File) => {
    if (!file) return;
    setError('');
    if (file.size > 10 * 1024 * 1024) {
      setError('Choose a file smaller than 10 MB.');
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('language', language);
      const result = await api<{ id: string; name: string; content: string }>('/uploads', {
        method: 'POST',
        body,
      });
      setUpload(result);
      setContent(result.content);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The file could not be read.');
    } finally {
      setUploading(false);
    }
  };
  const generate = async () => {
    setError('');
    setBusy(true);
    try {
      const result = await api<{ lessonId: string; jobId: string }>('/lessons/generate', {
        method: 'POST',
        body: JSON.stringify({
          title,
          subject,
          language,
          schoolLevel,
          content,
          inputType: mode,
          ...(upload ? { uploadId: upload.id } : {}),
        }),
      });
      setJobId(result.jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to start your lesson.');
      setBusy(false);
    }
  };
  if (!user || user.accountType === 'CHILD') return <Loading />;
  const currentStep = job?.progress || 0;
  if (jobId)
    return (
      <div className="generation-page">
        <div className="generation-orbit">
          <Mascot />
          <span className="orbit-spark one">✦</span>
          <span className="orbit-spark two">✧</span>
          <span className="orbit-spark three">✦</span>
        </div>
        <span className="subject-tag lavender">
          <Sparkles size={13} />
          <LocalizedText text="A little learning magic" />
        </span>
        <h1>
          <LocalizedText
            text={
              job?.status === 'COMPLETED'
                ? 'Your adventure is ready!'
                : job?.status === 'FAILED'
                  ? 'Let’s give that another go.'
                  : 'Bringing your ideas to life.'
            }
          />
        </h1>
        <p>
          <LocalizedText
            text={
              job?.status === 'FAILED'
                ? job.errorMessage || 'Try again.'
                : `We’re turning “${title}” into something you can experience.`
            }
          />
        </p>
        <section className="generation-card">
          <div className="generation-progress-label">
            <strong>
              <LocalizedText text={job?.step || 'Starting your adventure'} />
            </strong>
            <span>{currentStep}%</span>
          </div>
          <ProgressBar value={currentStep} />
          <div className="generation-steps">
            {[
              ['Reading your material', 5],
              ['Finding the big ideas', 20],
              ['Building game missions', 45],
              ['Checking your lesson', 75],
              ['Ready to play', 100],
            ].map(([label, progress]) => (
              <div className={currentStep >= Number(progress) ? 'done' : ''} key={label}>
                <span>
                  {currentStep >= Number(progress) ? (
                    <Check size={13} />
                  ) : Number(progress) === 45 && currentStep >= 20 ? (
                    <LoaderCircle size={13} className="spin" />
                  ) : (
                    <span />
                  )}
                </span>
                <LocalizedText text={String(label)} />
              </div>
            ))}
          </div>
          {error && (
            <p className="inline-error">
              <LocalizedText text={error} />
            </p>
          )}
          {job?.status === 'COMPLETED' && (
            <button
              className="button primary"
              onClick={() => router.push(parent ? lessonList : '/app/lesson/' + job.lessonId)}
            >
              <LocalizedText text={parent ? 'View family lessons' : 'Start my adventure'} />
              <ArrowRight size={17} />
            </button>
          )}
          {job?.status === 'FAILED' && (
            <button
              className="button primary"
              onClick={() => {
                setJobId('');
                setBusy(false);
                setJob(null);
              }}
            >
              <LocalizedText text="Back to my material" />
            </button>
          )}
        </section>
        <p className="generation-tip">
          <Lightbulb size={16} />
          <LocalizedText
            text={
              parent
                ? 'Your lesson is saved. You can return to Family lessons anytime.'
                : 'Your progress is saved. You can return to My lessons anytime.'
            }
          />
        </p>
      </div>
    );
  return (
    <div className="create-page">
      <div className="page-heading">
        <div>
          <div className="greeting">
            <Sparkles size={15} />
            <LocalizedText text="Your next adventure starts here" />
          </div>
          <h1>
            <LocalizedText
              text={
                parent
                  ? 'What would you like your children to learn?'
                  : 'What do you want to learn today?'
              }
            />
          </h1>
          <p>
            <LocalizedText
              text={
                parent
                  ? 'Create a learning game for your family. Your children will find it in My lessons.'
                  : 'A playable game, made from your topic.'
              }
            />
          </p>
        </div>
      </div>
      <div className="create-grid">
        <form
          className="create-form"
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
        >
          <div className="input-modes">
            {[
              { value: 'TEXT' as const, label: 'Paste text', icon: FileText },
              { value: 'PDF' as const, label: 'Upload PDF', icon: Upload },
              { value: 'IMAGE' as const, label: 'Upload image', icon: ImageIcon },
              { value: 'TOPIC' as const, label: 'Enter a topic', icon: Lightbulb },
            ].map(({ value, label, icon: Icon }) => (
              <button
                type="button"
                key={value}
                className={mode === value ? 'active' : ''}
                onClick={() => {
                  setMode(value);
                  setUpload(null);
                  setError('');
                }}
              >
                <Icon size={18} />
                <LocalizedText text={String(label)} />
              </button>
            ))}
          </div>
          <div className="create-fields">
            <label>
              <LocalizedText text="Give your adventure a title" />
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('e.g. Fractions made delicious')}
                maxLength={180}
                required
              />
            </label>
            <div className="form-row">
              <label>
                <LocalizedText text="Subject" />
                <select value={subject} onChange={(e) => setSubject(e.target.value as Subject)}>
                  {subjects.map((s) => (
                    <option key={s} value={s}>
                      {t(subjectLabels[s])}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <LocalizedText text="School level" />
                <select value={schoolLevel} onChange={(e) => setSchoolLevel(e.target.value)}>
                  {['Primary 1–3', 'Primary 4–6', 'Secondary 1–3', 'Secondary 4–5'].map((l) => (
                    <option key={l} value={l}>
                      {t(l)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <LocalizedText text="Lesson language" />
                <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                  {languages.map((l) => (
                    <option key={l} value={l}>
                      {t(l)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {mode === 'TEXT' || mode === 'TOPIC' ? (
              <label>
                <LocalizedText
                  text={mode === 'TEXT' ? 'Your textbook content' : 'What are you curious about?'}
                />
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={t(
                    mode === 'TEXT'
                      ? 'Paste a paragraph, a chapter, or a few notes here. We’ll find the big ideas and turn them into a little adventure.'
                      : 'e.g. How does the human heart pump blood around the body?',
                  )}
                  maxLength={40000}
                  required
                  rows={mode === 'TEXT' ? 9 : 5}
                />
                <span className="field-caption">
                  {content.length.toLocaleString()}
                  <LocalizedText text="/ 40,000 characters" />
                  <span>
                    <LocalizedText
                      text={
                        mode === 'TEXT'
                          ? 'A few paragraphs work beautifully.'
                          : 'Be as curious and specific as you like.'
                      }
                    />
                  </span>
                </span>
              </label>
            ) : (
              <div>
                <input
                  ref={fileInput}
                  className="sr-only"
                  type="file"
                  accept={mode === 'PDF' ? '.pdf' : '.png,.jpg,.jpeg'}
                  onChange={(e) => void uploadFile(e.target.files?.[0])}
                />
                {upload ? (
                  <div className="uploaded-file">
                    <FileText size={24} />
                    <div>
                      <strong>{upload.name}</strong>
                      <p>
                        {upload.content.length.toLocaleString()}{' '}
                        <LocalizedText text="characters ready to explore" />
                      </p>
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => {
                        setUpload(null);
                        setContent('');
                      }}
                      aria-label={t('Remove uploaded file')}
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="upload-zone"
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      void uploadFile(e.dataTransfer.files?.[0]);
                    }}
                  >
                    {uploading ? <LoaderCircle className="spin" size={30} /> : <Upload size={30} />}
                    <strong>
                      <LocalizedText
                        text={
                          uploading
                            ? 'Finding the words in your material…'
                            : 'Drop your learning material here'
                        }
                      />
                    </strong>
                    <span>
                      <LocalizedText text="or click to browse" /> ·{' '}
                      {mode === 'PDF' ? 'PDF' : 'PNG, JPG or JPEG'} ·{' '}
                      <LocalizedText text="up to 10 MB" />
                    </span>
                  </button>
                )}
                {upload && (
                  <label className="extracted-preview">
                    <LocalizedText text="Extracted material" />
                    <textarea value={content} readOnly rows={4} />
                  </label>
                )}
              </div>
            )}
            {error && (
              <p className="inline-error" role="alert">
                <LocalizedText text={error} />
              </p>
            )}
            <div className="create-form-footer">
              <span>
                <ShieldCheck size={15} />
                <LocalizedText text="Your lessons are private by default" />
              </span>
              <button
                className="button primary"
                disabled={busy || uploading || ((mode === 'PDF' || mode === 'IMAGE') && !upload)}
              >
                {busy ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />}
                <LocalizedText text="Generate interactive lesson" />
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </form>
        <aside className="create-side">
          <div className="create-wonder-note">
            <Mascot />
            <h3>
              <LocalizedText text="From “huh?” to “aha!”" />
            </h3>
            <p>
              <LocalizedText text="Create a game with missions, feedback and replay. Your learning progress stays saved." />
            </p>
            <div className="creation-feature">
              <Atom size={19} />
              <span>
                <LocalizedText text="Play, retry and discover." />
              </span>
            </div>
            <div className="creation-feature">
              <Sparkles size={19} />
              <span>
                <LocalizedText text="Learn by doing, not just reading" />
              </span>
            </div>
            <div className="creation-feature">
              <Check size={19} />
              <span>
                <LocalizedText text="Test yourself with playful quizzes" />
              </span>
            </div>
          </div>
          <div className="try-example">
            <h3>
              <LocalizedText text="Need a little inspiration?" />
            </h3>
            <p>
              <LocalizedText text="Try one of these starting topics." />
            </p>
            {examples.map((example, i) => (
              <button
                type="button"
                key={example.title}
                onClick={() => {
                  setMode('TEXT');
                  setTitle(example.title);
                  setSubject(example.subject);
                  setLanguage(example.language);
                  setContent(example.content);
                  setUpload(null);
                  setError('');
                }}
              >
                <span className={'example-dot ' + ['coral', 'mint', 'peach'][i]}>
                  {i === 0 ? '¼' : i === 1 ? '♡' : '⚑'}
                </span>
                <span>
                  <LocalizedText text={example.title} />
                  <small>
                    <LocalizedText text={subjectLabels[example.subject]} />
                  </small>
                </span>
                <ArrowRight size={15} />
              </button>
            ))}
            <span className="demo-note">
              <LocalizedText text="Choose a starting topic, or bring your own learning material." />
            </span>
          </div>
        </aside>
      </div>
      <button className="text-button" onClick={() => router.push(parent ? '/parent' : '/app')}>
        <ArrowLeft size={15} />
        <LocalizedText text={parent ? 'Back to family space' : 'Back to my learning space'} />
      </button>
    </div>
  );
}
