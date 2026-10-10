'use client';
import { useState, type FormEvent } from 'react';
import type {
  FamilyDashboard,
  FamilyChild,
  ChildCreateInput,
  ChildUpdateInput,
  SchoolGrade,
} from '@wonderlab/shared';
import { childCreateSchema, childUpdateSchema, schoolGrades } from '@wonderlab/shared';
import { Plus, Pencil, Pause, Play, KeyRound, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi, Loading, ErrorState } from './ui';
import { LocalizedText, useI18n } from './i18n';
import { avatars, ChildSummary } from './parent-dashboard';
const subjects = ['MATHEMATICS', 'SCIENCE', 'HISTORY', 'GEOGRAPHY', 'GENERAL'] as const;
const subjectLabel = {
  MATHEMATICS: 'Mathematics',
  SCIENCE: 'Science',
  HISTORY: 'History',
  GEOGRAPHY: 'Geography',
  GENERAL: 'General',
};
export function ParentChildren() {
  const { data, error, loading, reload } = useApi<FamilyDashboard>('/parent/dashboard');
  const [editing, setEditing] = useState<FamilyChild | 'new' | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const { t } = useI18n();
  const run = async (path: string, method: string, body: unknown, message: string) => {
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      await api(path, { method, body: JSON.stringify(body) });
      setNotice(message);
      setEditing(null);
      setResetting(null);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Unable to save changes.');
    } finally {
      setBusy(false);
    }
  };
  if (loading && !data) return <Loading label="Loading child profiles…" />;
  if (!data)
    return (
      <ErrorState message={error || 'Unable to load your family.'} retry={() => void reload()} />
    );
  const atLimit = data.children.length >= data.access.childLimit;
  return (
    <>
      <div className="family-heading family-row">
        <div>
          <h1>
            <LocalizedText text="Room for every curious mind." />
          </h1>
          <p>
            <LocalizedText text="Set up their own space, at a pace that works for your family." />
          </p>
        </div>
        <button
          className="button primary"
          disabled={atLimit || busy}
          onClick={() => {
            setEditing('new');
            setResetting(null);
            setActionError('');
          }}
        >
          <Plus size={18} />
          <LocalizedText text="Add child" />
        </button>
      </div>
      <div className="family-notice">
        <p>
          <LocalizedText text="Family login code" />: <strong>{data.family.code}</strong>{' '}
          <span className="family-subtle">
            ({data.children.length} / {data.access.childLimit} {t('Child profiles')})
          </span>
        </p>
        {atLimit && (
          <p>
            <LocalizedText text="Your plan’s child limit is reached. View subscription options to add more children." />
          </p>
        )}
      </div>
      {actionError && (
        <p className="family-error" role="alert">
          {actionError}
        </p>
      )}
      {error && <ErrorState message={error} retry={() => void reload()} />}
      {notice && (
        <p className="family-success" role="status">
          <LocalizedText text={notice} />
        </p>
      )}
      {editing && (
        <section className="family-panel family-editor">
          <div className="family-row">
            <h2>
              <LocalizedText text={editing === 'new' ? 'Add child' : 'Edit child profile'} />
            </h2>
            <button
              className="icon-button"
              aria-label={t('Close editor')}
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              <X size={20} />
            </button>
          </div>
          <ChildForm
            key={editing === 'new' ? 'new' : editing.id}
            child={editing === 'new' ? undefined : editing}
            busy={busy}
            onSave={(body) =>
              void run(
                editing === 'new' ? '/parent/children' : '/parent/children/' + editing.id,
                editing === 'new' ? 'POST' : 'PATCH',
                body,
                editing === 'new' ? 'Child profile created.' : 'Child profile updated.',
              )
            }
          />
        </section>
      )}
      <div className="family-profile-grid">
        {data.children.map((child) => (
          <section className="family-panel family-profile" key={child.id}>
            <ChildSummary child={child} />
            <p className="family-subtle">
              <LocalizedText text="Username" />: <strong>{child.username}</strong>
            </p>
            <div className="family-subject-tags">
              {child.allowedSubjects.map((subject) => (
                <span key={subject}>
                  <LocalizedText text={subjectLabel[subject]} />
                </span>
              ))}
              <span>
                <LocalizedText text="Parents create lessons" />
              </span>
            </div>
            <p className="family-subtle">
              <LocalizedText text="Allowed lesson grades" />:{' '}
              {child.allowedSchoolLevels
                ? child.allowedSchoolLevels.map((grade) => t(grade)).join(' · ')
                : t('All grades')}
            </p>
            <div className="family-profile-actions">
              <button
                className="family-quiet"
                disabled={busy}
                onClick={() => {
                  setEditing(child);
                  setResetting(null);
                  setActionError('');
                }}
              >
                <Pencil size={15} />
                <LocalizedText text="Edit profile" />
              </button>
              <button
                className="family-quiet"
                disabled={busy}
                onClick={() =>
                  void run(
                    '/parent/children/' + child.id,
                    'PATCH',
                    { status: child.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' },
                    child.status === 'ACTIVE'
                      ? 'Child learning paused.'
                      : 'Child learning resumed.',
                  )
                }
              >
                {child.status === 'ACTIVE' ? <Pause size={15} /> : <Play size={15} />}
                <LocalizedText
                  text={child.status === 'ACTIVE' ? 'Pause learning' : 'Resume learning'}
                />
              </button>
              <button
                className="family-quiet"
                disabled={busy}
                onClick={() => {
                  setResetting(resetting === child.id ? null : child.id);
                  setActionError('');
                }}
              >
                <KeyRound size={15} />
                <LocalizedText text="Reset passcode" />
              </button>
            </div>
            {resetting === child.id && (
              <form
                className="family-form family-reset"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  void run(
                    '/parent/children/' + child.id + '/passcode',
                    'POST',
                    { passcode: form.get('passcode') },
                    'Passcode reset. The child must sign in again.',
                  );
                }}
              >
                <label>
                  <LocalizedText text="New passcode" />
                  <input
                    name="passcode"
                    type="password"
                    minLength={6}
                    maxLength={72}
                    autoComplete="new-password"
                    required
                  />
                </label>
                <p>
                  <LocalizedText text="Use at least 6 characters. Resetting signs the child out of existing sessions." />
                </p>
                <button className="button secondary" disabled={busy}>
                  <LocalizedText text="Save new passcode" />
                </button>
              </form>
            )}
          </section>
        ))}
      </div>
      {!data.children.length && !editing && (
        <div className="family-empty">
          <span aria-hidden="true">🦉</span>
          <h2>
            <LocalizedText text="Their adventure starts here" />
          </h2>
          <p>
            <LocalizedText text="Add a child profile, then share the family code and their login details." />
          </p>
        </div>
      )}
    </>
  );
}
function ChildForm({
  child,
  busy,
  onSave,
}: {
  child?: FamilyChild;
  busy: boolean;
  onSave: (input: ChildCreateInput | ChildUpdateInput) => void;
}) {
  const [validation, setValidation] = useState('');
  const [selected, setSelected] = useState<string[]>(child?.allowedSubjects || [...subjects]);
  const [allGrades, setAllGrades] = useState(child?.allowedSchoolLevels == null);
  const [selectedGrades, setSelectedGrades] = useState<SchoolGrade[]>(
    child?.allowedSchoolLevels || [],
  );
  const { t } = useI18n();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const body = {
      name: String(values.get('name')),
      schoolLevel: String(values.get('schoolLevel')),
      avatar: values.get('avatar'),
      dailyMinutesLimit: Number(values.get('dailyMinutesLimit')),
      ...(!child ? { canGenerate: false } : {}),
      allowedSubjects: selected,
      allowedSchoolLevels: allGrades ? null : selectedGrades,
      ...(!child ? { username: values.get('username'), passcode: values.get('passcode') } : {}),
    };
    const result = child ? childUpdateSchema.safeParse(body) : childCreateSchema.safeParse(body);
    if (!result.success) {
      setValidation(
        result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(' '),
      );
      return;
    }
    setValidation('');
    onSave(result.data);
  };
  return (
    <form className="family-form" onSubmit={submit}>
      <div className="family-form-grid">
        <label>
          <LocalizedText text="Child’s name" />
          <input name="name" defaultValue={child?.name} minLength={2} maxLength={100} required />
        </label>
        <label>
          <LocalizedText text="School level" />
          <input
            name="schoolLevel"
            defaultValue={child?.schoolLevel}
            placeholder={t('e.g. Primary 3')}
            minLength={2}
            maxLength={64}
            required
          />
        </label>
        {!child && (
          <>
            <label>
              <LocalizedText text="Username" />
              <input
                name="username"
                minLength={3}
                maxLength={32}
                pattern={'[a-z0-9][a-z0-9_\\-]{2,31}'}
                autoCapitalize="none"
                autoComplete="off"
                required
              />
              <small>
                <LocalizedText text="3–32 lowercase letters, numbers, underscores or hyphens." />
              </small>
            </label>
            <label>
              <LocalizedText text="Passcode" />
              <input
                type="password"
                name="passcode"
                minLength={6}
                maxLength={72}
                autoComplete="new-password"
                required
              />
            </label>
          </>
        )}
        <label>
          <LocalizedText text="Daily learning allowance (minutes)" />
          <input
            name="dailyMinutesLimit"
            type="number"
            min={5}
            max={240}
            step={1}
            defaultValue={child?.dailyMinutesLimit || 30}
            required
          />
        </label>
      </div>
      <fieldset>
        <legend>
          <LocalizedText text="Choose an avatar" />
        </legend>
        <div className="family-avatar-choices">
          {Object.entries(avatars).map(([avatar, emoji]) => (
            <label key={avatar}>
              <input
                type="radio"
                name="avatar"
                value={avatar}
                defaultChecked={avatar === (child?.avatar || 'fox')}
              />
              <span aria-hidden="true">{emoji}</span>
              <LocalizedText text={avatar[0].toUpperCase() + avatar.slice(1)} />
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>
          <LocalizedText text="Allowed subjects" />
        </legend>
        <div className="family-checkboxes">
          {subjects.map((subject) => (
            <label key={subject}>
              <input
                type="checkbox"
                checked={selected.includes(subject)}
                onChange={(event) =>
                  setSelected(
                    event.target.checked
                      ? [...selected, subject]
                      : selected.filter((item) => item !== subject),
                  )
                }
              />
              <LocalizedText text={subjectLabel[subject]} />
            </label>
          ))}
        </div>
        <small>
          <LocalizedText text="Choose at least one subject." />
        </small>
      </fieldset>
      <fieldset>
        <legend>
          <LocalizedText text="Allowed lesson grades" />
        </legend>
        <div className="family-checkboxes">
          <label>
            <input
              type="radio"
              name="gradeAccess"
              checked={allGrades}
              onChange={() => setAllGrades(true)}
            />
            <LocalizedText text="All grades" />
          </label>
          <label>
            <input
              type="radio"
              name="gradeAccess"
              checked={!allGrades}
              onChange={() => setAllGrades(false)}
            />
            <LocalizedText text="Choose specific grades" />
          </label>
        </div>
        {!allGrades && (
          <>
            <div className="family-checkboxes">
              {schoolGrades.map((grade) => (
                <label key={grade}>
                  <input
                    type="checkbox"
                    checked={selectedGrades.includes(grade)}
                    onChange={(event) =>
                      setSelectedGrades(
                        event.target.checked
                          ? [...selectedGrades, grade]
                          : selectedGrades.filter((item) => item !== grade),
                      )
                    }
                  />
                  <LocalizedText text={grade} />
                </label>
              ))}
            </div>
            <p>
              <LocalizedText text="Choose one or more grades. Lessons for other grades will be hidden from your child." />
            </p>
            <small>
              <LocalizedText text="Includes lessons covering a selected grade. Lessons without a recognised grade are hidden." />
            </small>
          </>
        )}
      </fieldset>
      {validation && (
        <p role="alert" className="family-error">
          {validation}
        </p>
      )}
      <button
        className="button primary"
        disabled={busy || selected.length === 0 || (!allGrades && selectedGrades.length === 0)}
      >
        <LocalizedText text={busy ? 'Saving…' : child ? 'Save changes' : 'Create child profile'} />
      </button>
    </form>
  );
}
