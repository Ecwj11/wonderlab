'use client';
import { LocalizedText, useI18n } from '@/components/i18n';
import Link from 'next/link';
import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Plus, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  subjects,
  canCreateLessons,
  lessonCreationPath,
  subjectLabels,
  languages,
  type Paginated,
  type LessonSummary,
} from '@wonderlab/shared';
import { useApi, Loading, ErrorState, EmptyState } from './ui';
import { LessonCard } from './lesson-card';
import { useSession } from './session';
import { Mascot } from './art';
export function LessonCollection({ library = false }: { library?: boolean }) {
  return (
    <Suspense fallback={<Loading />}>
      <Collection library={library} />
    </Suspense>
  );
}
function Collection({ library }: { library: boolean }) {
  const { t } = useI18n();
  const { user } = useSession();
  const canCreate = canCreateLessons(user);

  const params = useSearchParams();
  const [subject, setSubject] = useState(params.get('subject') || 'ALL');
  const [search, setSearch] = useState(params.get('search') || '');
  const [query, setQuery] = useState(search);
  const [language, setLanguage] = useState('');
  const [sort, setSort] = useState('newest');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    setSubject(params.get('subject') || 'ALL');
    setSearch(params.get('search') || '');
    setPage(1);
  }, [params]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const filters = new URLSearchParams({
    page: String(page),
    pageSize: '9',
    subject,
    search: query,
    sort,
    ...(language ? { language } : {}),
    ...(status ? { status } : {}),
  });
  const { data, error, loading, reload } = useApi<Paginated<LessonSummary>>(
    (library ? '/library' : '/lessons') + '?' + filters,
  );
  useEffect(() => {
    if (library || !data?.data.some((lesson) => lesson.status === 'GENERATING')) return;
    const timer = window.setTimeout(() => void reload(), 2500);
    return () => window.clearTimeout(timer);
  }, [data, library, reload]);
  return (
    <div className="collection-page">
      <div className="page-heading">
        <div>
          <div className="greeting">
            <Sparkles size={14} />
            <LocalizedText
              text={library ? 'A world of little wonders' : 'Your curiosity, collected'}
            />
          </div>
          <h1>
            <LocalizedText
              text={library ? 'What will you discover next?' : 'Your learning adventures.'}
            />
          </h1>
          <p>
            <LocalizedText
              text={
                library
                  ? 'Made to explore. Designed to make it click.'
                  : 'Every lesson is a little world waiting to be explored.'
              }
            />
          </p>
        </div>
        {!library && canCreate && (
          <Link href={lessonCreationPath(user)} className="button primary">
            <Plus size={16} />
            <LocalizedText text="Create a lesson" />
          </Link>
        )}
      </div>
      {library && (
        <section className="collection-banner">
          <div>
            <h2>
              <LocalizedText text="A little something for every curious mind." />
            </h2>
            <p>
              <LocalizedText text="Explore our collection, make a lesson your own, and learn at your pace." />
            </p>
          </div>
          <Mascot />
        </section>
      )}
      <div className="collection-toolbar">
        <div className="filter-tabs">
          {['ALL', ...subjects].map((s) => (
            <button
              key={s}
              className={subject === s ? 'active' : ''}
              onClick={() => {
                setSubject(s);
                setPage(1);
              }}
            >
              <LocalizedText
                text={s === 'ALL' ? 'All subjects' : subjectLabels[s as (typeof subjects)[number]]}
              />
            </button>
          ))}
        </div>
        <div className="collection-controls">
          <form className="collection-search" onSubmit={(e) => e.preventDefault()}>
            <Search size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Find your next discovery…')}
              aria-label={t('Search lessons')}
            />
          </form>
          {library ? (
            <>
              <select
                aria-label={t('Lesson language')}
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">{t('All languages')}</option>
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {t(l)}
                  </option>
                ))}
              </select>
              <select
                aria-label={t('Sort lessons')}
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="newest">{t('Newest first')}</option>
                <option value="popular">{t('Most explored')}</option>
              </select>
            </>
          ) : (
            <select
              aria-label={t('Lesson status')}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('All adventures')}</option>
              <option value="READY">{t('Ready to play')}</option>
              <option value="GENERATING">{t('Preparing…')}</option>
              <option value="IN_PROGRESS">{t('In progress')}</option>
              <option value="COMPLETED">{t('Completed')}</option>
              <option value="FAILED">{t('Could not prepare')}</option>
            </select>
          )}
        </div>
      </div>
      {data && (
        <p className="collection-count">
          <LocalizedText
            text={`${data.total} ${data.total === 1 ? 'adventure' : 'adventures'} ${library ? 'to spark your curiosity' : 'in your learning space'}`}
          />
        </p>
      )}
      {error ? (
        <ErrorState message={error} retry={() => void reload()} />
      ) : loading && !data ? (
        <Loading label="Finding your adventures…" />
      ) : data?.data.length ? (
        <>
          <div className="lesson-grid collection-grid">
            {data.data.map((l) => (
              <LessonCard key={l.id} lesson={l} library={library} onChange={() => void reload()} />
            ))}
          </div>
          {data.totalPages > 1 && (
            <div className="pagination">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                aria-label={t('Previous page')}
              >
                <ChevronLeft size={15} />
              </button>
              <span>
                <LocalizedText text={`Page ${page} of ${data.totalPages}`} />
              </span>
              <button
                disabled={page === data.totalPages}
                onClick={() => setPage(page + 1)}
                aria-label={t('Next page')}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          title={t('A new adventure is just around the corner.')}
          description={
            canCreate
              ? 'Try another subject or search, or turn something you’re curious about into a lesson.'
              : 'Try another subject or search, or ask your parent to prepare a new lesson.'
          }
        >
          {canCreate ? (
            <Link href={lessonCreationPath(user)} className="button primary">
              <Sparkles size={16} />
              <LocalizedText text="Create a lesson" />
            </Link>
          ) : (
            <Link href="/app/library" className="button primary">
              <LocalizedText text="Explore the library" />
            </Link>
          )}
        </EmptyState>
      )}
    </div>
  );
}
