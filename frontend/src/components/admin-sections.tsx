'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  Search,
  Eye,
  Code2,
  Globe,
  RotateCcw,
  Trash2,
  Check,
  LoaderCircle,
  Shield,
  BrainCircuit,
  Settings,
  ArrowUpRight,
} from 'lucide-react';
import type { Paginated } from '@wonderlab/shared';
import { api } from '@/lib/api';
import { useApi, Loading, ErrorState, Modal, EmptyState } from './ui';
import { AdminAppearance } from './admin-appearance';
import { GenerationAgentInspector } from './generation-agent-inspector';
type Row = Record<string, unknown>;
const label = (value: unknown) => (value === null || value === undefined ? '—' : String(value));
const date = (value: unknown) =>
  value
    ? new Date(String(value)).toLocaleDateString('en', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';
const titles: Record<string, [string, string]> = {
  users: ['User management', 'View accounts, update access and manage account status.'],
  lessons: ['Lesson management', 'Inspect definitions, preview lessons and manage publication.'],
  'generation-jobs': [
    'Generation jobs',
    'Follow every job from source material to validated interactive lesson.',
  ],
  'content-library': [
    'Content library',
    'Review published lessons available to curious minds everywhere.',
  ],
  usage: ['AI usage', 'Recorded tokens and estimated provider costs for generation jobs.'],
};
export function AdminTable({ section }: { section: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  const [modal, setModal] = useState<'user' | 'json' | 'job' | 'delete' | null>(null);
  const [json, setJson] = useState<unknown>(null);
  const [status, setStatus] = useState('ACTIVE');
  const [role, setRole] = useState('STUDENT');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    setPage(1);
    setSearch('');
    setQuery('');
    setNotice('');
  }, [section]);
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);
  const endpoint = section === 'content-library' ? 'lessons' : section;
  const filters = new URLSearchParams({
    page: String(page),
    pageSize: '12',
    search: query,
    ...(section === 'content-library' ? { visibility: 'PUBLIC' } : {}),
  });
  const { data, error, loading, reload } = useApi<Paginated<Row>>(
    '/admin/' + endpoint + '?' + filters,
  );
  const openUser = (row: Row) => {
    setSelected(row);
    setRole(String(row.roles || 'STUDENT').split(',')[0]);
    setStatus(String(row.status));
    setActionError('');
    setModal('user');
  };
  const inspect = async (row: Row) => {
    setBusy(true);
    setActionError('');
    try {
      setJson(await api('/admin/lessons/' + row.id + '/json'));
      setSelected(row);
      setModal('json');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Unable to inspect JSON.');
    } finally {
      setBusy(false);
    }
  };
  const action = async (row: Row, kind: 'publish' | 'delete' | 'regenerate') => {
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      if (kind === 'publish') {
        await api('/admin/lessons/' + row.id, {
          method: 'PATCH',
          body: JSON.stringify({ visibility: row.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC' }),
        });
        setNotice(row.visibility === 'PUBLIC' ? 'Lesson unpublished.' : 'Lesson published.');
      }
      if (kind === 'delete') {
        await api('/admin/lessons/' + row.id, { method: 'DELETE' });
        setModal(null);
        setNotice('Lesson deleted.');
      }
      if (kind === 'regenerate') {
        await api('/admin/lessons/' + row.id + '/regenerate', { method: 'POST' });
        setNotice('A new generation job has been queued.');
      }
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Unable to perform this action.');
    } finally {
      setBusy(false);
    }
  };
  const columns =
    section === 'users'
      ? ['User', 'Role', 'Status', 'Level / XP', 'Lessons', 'Last login', 'Actions']
      : section === 'generation-jobs'
        ? ['Lesson / Job', 'Status', 'Progress', 'Provider / Model', 'Created', 'Actions']
        : section === 'usage'
          ? [
              'User',
              'Provider / Model',
              'Input tokens',
              'Output tokens',
              'Estimated cost',
              'Created',
            ]
          : [
              'Lesson / ID',
              'Owner',
              'Subject / Language',
              'Status',
              'Visibility',
              'Schema',
              'Created',
              'Actions',
            ];
  return (
    <div>
      <div className="admin-page-heading">
        <div>
          <h1>{titles[section]?.[0]}</h1>
          <p>{titles[section]?.[1]}</p>
        </div>
        <button className="button secondary" onClick={() => void reload()}>
          Refresh data
        </button>
      </div>
      <div className="admin-table-toolbar">
        <form className="collection-search" onSubmit={(e) => e.preventDefault()}>
          <Search size={16} />
          <input
            placeholder={section === 'users' ? 'Search name or email…' : 'Search lesson titles…'}
            aria-label="Search records"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
        <span>{data?.total || 0} records</span>
      </div>
      {notice && (
        <div className="admin-notice" role="status">
          <Check size={15} />
          {notice}
        </div>
      )}
      {actionError && !modal && (
        <p className="inline-error" role="alert">
          {actionError}
        </p>
      )}
      {error ? (
        <ErrorState message={error} retry={() => void reload()} />
      ) : loading && !data ? (
        <Loading />
      ) : data?.data.length ? (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.data.map((row) => (
                <tr key={label(row.id)}>
                  {section === 'users' ? (
                    <>
                      <td>
                        <div className="table-user">
                          <span className="avatar">{label(row.name).slice(0, 1)}</span>
                          <div>
                            <strong>{label(row.name)}</strong>
                            <small>{label(row.email)}</small>
                            <code>{label(row.id).slice(0, 8)}</code>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="admin-role">{label(row.roles)}</span>
                      </td>
                      <td>
                        <Status value={label(row.status)} />
                      </td>
                      <td>
                        Level {label(row.level)}
                        <small>{label(row.xp)} XP</small>
                      </td>
                      <td>{label(row.lessonsGenerated)}</td>
                      <td>{date(row.lastLogin)}</td>
                      <td>
                        <button className="table-action" onClick={() => openUser(row)}>
                          <Eye size={14} />
                          Manage
                        </button>
                      </td>
                    </>
                  ) : section === 'generation-jobs' ? (
                    <>
                      <td>
                        <strong>{label(row.title)}</strong>
                        <code>{label(row.id)}</code>
                      </td>
                      <td>
                        <Status value={label(row.status)} />
                      </td>
                      <td>
                        <strong>{label(row.progress)}%</strong>
                        <small className="table-step">{label(row.step)}</small>
                      </td>
                      <td>
                        {label(row.provider)}
                        <small>{label(row.model)}</small>
                      </td>
                      <td>{date(row.createdAt)}</td>
                      <td>
                        <button
                          className="table-action"
                          onClick={() => {
                            setSelected(row);
                            setModal('job');
                          }}
                        >
                          <Eye size={14} />
                          Details
                        </button>
                      </td>
                    </>
                  ) : section === 'usage' ? (
                    <>
                      <td>{label(row.userName)}</td>
                      <td>
                        {label(row.provider)}
                        <small>{label(row.model)}</small>
                      </td>
                      <td>{row.provider === 'codex' ? 'Not reported' : label(row.tokens_input)}</td>
                      <td>
                        {row.provider === 'codex' ? 'Not reported' : label(row.tokens_output)}
                      </td>
                      <td>
                        {row.provider === 'codex'
                          ? 'Not reported'
                          : '$' + Number(row.estimated_cost || 0).toFixed(6)}
                      </td>
                      <td>{date(row.created_at)}</td>
                    </>
                  ) : (
                    <>
                      <td>
                        <strong className="table-lesson-title">{label(row.title)}</strong>
                        <code>{label(row.id).slice(0, 8)}</code>
                      </td>
                      <td>{label(row.ownerName)}</td>
                      <td>
                        {label(row.subject)}
                        <small>{label(row.language)}</small>
                      </td>
                      <td>
                        <Status value={label(row.status)} />
                      </td>
                      <td>
                        <Status value={label(row.visibility)} />
                      </td>
                      <td>v{label(row.schemaVersion)}</td>
                      <td>{date(row.createdAt)}</td>
                      <td>
                        <div className="table-actions">
                          <Link
                            href={'/app/lesson/' + row.id}
                            title="Preview lesson"
                            className="table-icon"
                          >
                            <Eye size={15} />
                          </Link>
                          <button
                            className="table-icon"
                            title="View JSON"
                            onClick={() => void inspect(row)}
                            disabled={busy || row.status !== 'READY'}
                          >
                            <Code2 size={15} />
                          </button>
                          <button
                            className="table-icon"
                            title={row.visibility === 'PUBLIC' ? 'Unpublish' : 'Publish'}
                            onClick={() => void action(row, 'publish')}
                            disabled={busy || row.status !== 'READY'}
                          >
                            <Globe size={15} />
                          </button>
                          <button
                            className="table-icon"
                            title="Regenerate lesson"
                            onClick={() => void action(row, 'regenerate')}
                            disabled={busy || row.status === 'GENERATING'}
                          >
                            <RotateCcw size={15} />
                          </button>
                          <button
                            className="table-icon delete"
                            title="Delete lesson"
                            onClick={() => {
                              setSelected(row);
                              setActionError('');
                              setModal('delete');
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No records found."
          description="Try another search or return after more activity."
        />
      )}
      {data && data.totalPages > 1 && (
        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {data.totalPages}
          </span>
          <button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      )}
      {modal === 'user' && selected && (
        <Modal title={'Manage ' + selected.name} onClose={() => setModal(null)}>
          <div className="admin-edit-form">
            <p>
              {label(selected.email)} · Account {label(selected.id)}
            </p>
            <label>
              Account status
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option>ACTIVE</option>
                <option>SUSPENDED</option>
              </select>
            </label>
            <label>
              Role
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {['STUDENT', 'PARENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN'].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <p>
              Administrator access changes require a super administrator. Suspended accounts lose
              API access immediately.
            </p>
            {actionError && <p className="inline-error">{actionError}</p>}
            <div className="modal-actions">
              <button className="button secondary" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setActionError('');
                  try {
                    await api('/admin/users/' + selected.id, {
                      method: 'PATCH',
                      body: JSON.stringify({ status, role }),
                    });
                    setModal(null);
                    setNotice('Account updated.');
                    await reload();
                  } catch (e) {
                    setActionError(e instanceof Error ? e.message : 'Unable to update.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? <LoaderCircle size={15} className="spin" /> : <Shield size={15} />}Save
                account changes
              </button>
            </div>
          </div>
        </Modal>
      )}
      {modal === 'json' && (
        <Modal title="Validated lesson definition" onClose={() => setModal(null)}>
          <p>Schema version 1 · Private answer keys are visible to administrators.</p>
          <div className="json-viewer">
            <JsonNode value={json} />
          </div>
          <details className="raw-json">
            <summary>View raw JSON</summary>
            <pre>{JSON.stringify(json, null, 2)}</pre>
          </details>
        </Modal>
      )}
      {modal === 'job' && selected && (
        <Modal title="Generation job details" onClose={() => setModal(null)}>
          <GenerationAgentInspector jobId={String(selected.id)} />
          <dl className="job-details">
            {Object.entries(selected).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{label(value)}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}
      {modal === 'delete' && selected && (
        <Modal title="Delete this lesson?" onClose={() => setModal(null)}>
          <p>
            “{label(selected.title)}” and its lesson progress will be permanently removed. Earned XP
            is preserved.
          </p>
          {actionError && <p className="inline-error">{actionError}</p>}
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setModal(null)}>
              Keep lesson
            </button>
            <button
              className="button danger"
              onClick={() => void action(selected, 'delete')}
              disabled={busy}
            >
              Delete lesson
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className={'admin-status ' + value.toLowerCase()}>
      {value.replaceAll('_', ' ').toLowerCase()}
    </span>
  );
}
function JsonNode({ value, name }: { value: unknown; name?: string }) {
  if (value !== null && typeof value === 'object') {
    return (
      <details open={!name}>
        <summary>
          {name ? <strong>{name}</strong> : null}{' '}
          <span>
            {Array.isArray(value)
              ? `[${value.length} items]`
              : `{${Object.keys(value).length} fields}`}
          </span>
        </summary>
        <div>
          {Object.entries(value).map(([key, val]) => (
            <JsonNode key={key} name={key} value={val} />
          ))}
        </div>
      </details>
    );
  }
  return (
    <div className="json-value">
      <strong>{name}:</strong>{' '}
      <span className={typeof value === 'number' ? 'number' : 'string'}>
        {JSON.stringify(value)}
      </span>
    </div>
  );
}
interface AIConfig {
  provider: string;
  model: string;
  providers: { name: string; configured: boolean }[];
  workerEnabled: boolean;
  schemaVersion: number;
}
export function AdminConfiguration() {
  const { data, error, loading, reload } = useApi<AIConfig>('/admin/config');
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error} retry={() => void reload()} />;
  return (
    <div>
      <div className="admin-page-heading">
        <div>
          <h1>AI configuration</h1>
          <p>Server-side providers and the validated lesson-generation contract.</p>
        </div>
      </div>
      <section className="admin-panel">
        <div className="admin-config-active">
          <BrainCircuit size={30} />
          <div>
            <span>Active provider</span>
            <h2>{data.provider}</h2>
            <p>{data.model}</p>
          </div>
          <Status value={data.workerEnabled ? 'ACTIVE' : 'DISABLED'} />
        </div>
        <div className="admin-config-grid">
          {data.providers.map((p) => (
            <article key={p.name}>
              <h3>{p.name}</h3>
              <Status value={p.configured ? 'CONFIGURED' : 'KEY_REQUIRED'} />
              <p>
                {p.name === 'codex'
                  ? 'Local Codex session subagents claim durable requests. Requires an active session consumer; no API key is used.'
                  : p.name === 'mock'
                    ? 'Deterministic demo lessons. No API key needed.'
                    : 'Provider keys are configured in backend environment variables.'}
              </p>
            </article>
          ))}
        </div>
        <p className="admin-info-note">
          {data.provider === 'codex' &&
            'Codex session execution is selected. Requests wait for a session subagent; this setting does not launch Codex automatically. Session token and cost usage are not reported. '}
          Update AI_PROVIDER, AI_MODEL and the matching API key in the backend environment, then
          restart the service. Keys never reach the browser. Every response is validated against
          lesson schema v{data.schemaVersion}.
        </p>
      </section>
    </div>
  );
}
export function AdminSubjects() {
  const { data, error, loading, reload } =
    useApi<{ id: string; name: string; color: string; lessons: number }[]>('/admin/subjects');
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error} retry={() => void reload()} />;
  return (
    <div>
      <div className="admin-page-heading">
        <div>
          <h1>Subjects</h1>
          <p>The current educational catalogue and lesson distribution.</p>
        </div>
      </div>
      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Identifier</th>
              <th>Lessons</th>
              <th>Explore</th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.id}>
                <td>
                  <span className={'subject-tag ' + s.color}>{s.name}</span>
                </td>
                <td>
                  <code>{s.id}</code>
                </td>
                <td>{s.lessons}</td>
                <td>
                  <Link className="table-action" href={'/app/library?subject=' + s.id}>
                    Open library
                    <ArrowUpRight size={14} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="admin-info-note">
        Adding a subject requires a migration and an update to the shared subject contract. This
        keeps AI output and lesson filters consistent.
      </p>
    </div>
  );
}
export function AdminSettings() {
  const { data, error, loading, reload } = useApi<{
    dailyGoalMinutes: number;
    maxDailyGenerations: number;
  }>('/admin/settings');
  const [goal, setGoal] = useState(15);
  const [quota, setQuota] = useState(20);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [saveError, setSaveError] = useState('');
  useEffect(() => {
    if (data) {
      setGoal(data.dailyGoalMinutes);
      setQuota(data.maxDailyGenerations);
    }
  }, [data]);
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error} retry={() => void reload()} />;
  return (
    <div>
      <div className="admin-page-heading">
        <div>
          <h1>System settings</h1>
          <p>Student portal templates, learning goals and generation allowances.</p>
        </div>
      </div>
      <AdminAppearance />
      <form
        className="admin-panel admin-settings-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setNotice('');
          setSaveError('');
          try {
            await api('/admin/settings', {
              method: 'PATCH',
              body: JSON.stringify({ dailyGoalMinutes: goal, maxDailyGenerations: quota }),
            });
            setNotice('Settings saved. New learning and generation requests use these values.');
          } catch (e) {
            setSaveError(e instanceof Error ? e.message : 'Unable to save.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>
          <Settings size={18} />
          Learning defaults
        </h2>
        <label>
          Daily learning goal (minutes)
          <input
            type="number"
            min={5}
            max={60}
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value))}
          />
          <small>Shown on each student’s dashboard. Between 5 and 60 minutes.</small>
        </label>
        <label>
          Daily generations per account
          <input
            type="number"
            min={1}
            max={100}
            value={quota}
            onChange={(e) => setQuota(Number(e.target.value))}
          />
          <small>Enforced transactionally by the API. Resets at midnight UTC.</small>
        </label>
        {notice && (
          <p className="success-message" role="status">
            {notice}
          </p>
        )}
        {saveError && (
          <p className="inline-error" role="alert">
            {saveError}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}Save system
          settings
        </button>
      </form>
    </div>
  );
}
