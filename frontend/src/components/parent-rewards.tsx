'use client';
import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Gift, Plus, Pencil, Pause, Play, Star } from 'lucide-react';
import {
  rewardEmojis,
  rewardImageKeys,
  rewardImages,
  rewardInputSchema,
  rewardRulesSchema,
  type FamilyReward,
  type RewardInput,
  type RewardRules,
  type ParentRewardsDashboard,
  type RewardRedemption,
  type Paginated,
} from '@wonderlab/shared';
import { api } from '@/lib/api';
import { LocalizedText as Text, useI18n, chineseText } from './i18n';
import { Loading, ErrorState, Modal } from './ui';
import {
  RewardPicture,
  useRewardsApi,
  RewardsPagination,
  RewardDate,
  rewardStatus,
} from './rewards-ui';

const emptyPrize: RewardInput = {
  name: '',
  description: '',
  emoji: '🎁',
  imageKey: null,
  starCost: 50,
  childId: null,
  isActive: true,
};
const templates = [
  {
    name: 'Ice cream outing',
    description: 'Choose a flavour together on our next outing.',
    emoji: '🍦',
    starCost: 50,
  },
  {
    name: 'Family movie night',
    description: 'Pick a movie for us to enjoy together.',
    emoji: '🎬',
    starCost: 80,
  },
  {
    name: 'A new book',
    description: 'Choose a book together at the bookshop or library.',
    emoji: '📚',
    starCost: 100,
  },
] as const;
type Confirmation =
  | { kind: 'pause'; prize: FamilyReward }
  | { kind: 'rules'; rules: RewardRules }
  | { kind: 'decision'; request: RewardRedemption; status: 'FULFILLED' | 'DECLINED' };
export function ParentRewards() {
  const dashboard = useRewardsApi<ParentRewardsDashboard>('/parent/rewards/dashboard');
  const [prizePage, setPrizePage] = useState(1);
  const [requestPage, setRequestPage] = useState(1);
  const [childId, setChildId] = useState('');
  const [status, setStatus] = useState('PENDING');
  const prizes = useRewardsApi<Paginated<FamilyReward>>(
    `/parent/rewards?page=${prizePage}${childId ? `&childId=${childId}` : ''}`,
  );
  const requests = useRewardsApi<Paginated<RewardRedemption>>(
    `/parent/rewards/redemptions?page=${requestPage}${childId ? `&childId=${childId}` : ''}${status ? `&status=${status}` : ''}`,
  );
  const [editing, setEditing] = useState<{ id?: string; input: RewardInput } | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const { t, language } = useI18n();
  const run = async (path: string, method: string, body: unknown, message: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(path, { method, body: JSON.stringify(body) });
      setEditing(null);
      setConfirmation(null);
      setNotice(message);
      setRequestPage(1);
      await Promise.all([dashboard.reload(), prizes.reload(), requests.reload()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save changes.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const confirm = () => {
    if (!confirmation) return;
    if (confirmation.kind === 'rules')
      void run('/parent/rewards/settings', 'PUT', confirmation.rules, 'Earning rules saved.');
    else if (confirmation.kind === 'pause') {
      const p = confirmation.prize;
      void run(
        `/parent/rewards/${p.id}`,
        'PATCH',
        {
          name: p.name,
          description: p.description,
          emoji: p.emoji,
          imageKey: p.imageKey,
          starCost: p.starCost,
          childId: p.childId,
          isActive: !p.isActive,
        },
        p.isActive ? 'Prize paused.' : 'Prize enabled.',
      );
    } else
      void run(
        `/parent/rewards/redemptions/${confirmation.request.id}`,
        'PATCH',
        { status: confirmation.status, note: note.trim() },
        confirmation.status === 'FULFILLED'
          ? 'Prize marked as given.'
          : 'Request declined. Stars returned.',
      );
  };
  if (dashboard.loading && !dashboard.data) return <Loading label="Loading family prizes…" />;
  if (!dashboard.data)
    return (
      <ErrorState
        message={dashboard.error || 'Unable to load prizes.'}
        retry={() => void dashboard.reload()}
      />
    );
  const data = dashboard.data;
  return (
    <div className="rewards-page parent-rewards">
      <div className="family-heading family-row">
        <div>
          <h1>
            <Text text="Little efforts, lovely rewards." />
          </h1>
          <p>
            <Text text="Choose real treats and experiences your family can enjoy together." />
          </p>
        </div>
        <button
          className="button primary"
          disabled={busy || !data.children.length}
          onClick={() => {
            setError('');
            setEditing({ input: { ...emptyPrize } });
          }}
        >
          <Plus size={18} />
          <Text text="Add prize" />
        </button>
      </div>
      <p className="rewards-explainer">
        <Star size={18} />
        <Text text="Stars are for family prizes. XP still grows learning levels, and is never spent." />
      </p>
      {notice && (
        <p className="family-success" role="status">
          <Text text={notice} />
        </p>
      )}
      {error && (
        <p className="family-error" role="alert">
          <Text text={error} />
        </p>
      )}
      {dashboard.error && (
        <ErrorState message={dashboard.error} retry={() => void dashboard.reload()} />
      )}
      {!data.children.length && (
        <section className="family-panel">
          <h2>
            <Text text="Start with a child profile" />
          </h2>
          <p>
            <Text text="Add a child to your family, then choose prizes they can work towards." />
          </p>
          <Link className="button primary" href="/parent/children">
            <Text text="Add child" />
          </Link>
        </section>
      )}
      <section className="family-panel rewards-section">
        <h2>
          <Text text="Your children’s Stars" />
        </h2>
        <div className="rewards-balances">
          {data.children.map((child) => (
            <div key={child.id}>
              <strong>{child.name}</strong>
              <span>
                <Star size={18} />
                {child.balance.toLocaleString()} <Text text="Stars" />
              </span>
              <small>
                <Text text={`${child.lifetimeEarned} Stars earned in total`} />
              </small>
            </div>
          ))}
        </div>
      </section>
      <section className="family-panel rewards-section">
        <h2>
          <Text text="How Stars are earned" />
        </h2>
        <p>
          <Text text="Rules apply to future learning. Each lesson and quiz earns Stars only once." />
        </p>
        <form
          key={JSON.stringify(data.rules)}
          className="family-form"
          onSubmit={(event) => {
            event.preventDefault();
            const values = new FormData(event.currentTarget);
            const result = rewardRulesSchema.safeParse({
              lessonStars: Number(values.get('lessonStars')),
              correctAnswerStars: Number(values.get('correctAnswerStars')),
              perfectQuizBonusStars: Number(values.get('perfectQuizBonusStars')),
            });
            if (!result.success) {
              setError('Use whole numbers from 0 to 100 for earning rules.');
              return;
            }
            setError('');
            setConfirmation({ kind: 'rules', rules: result.data });
          }}
        >
          <div className="rewards-rule-inputs">
            {(
              [
                ['lessonStars', 'Completed lesson'],
                ['correctAnswerStars', 'Correct quiz answer'],
                ['perfectQuizBonusStars', 'Perfect quiz bonus'],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                <Text text={label} />
                <input
                  name={key}
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  required
                  defaultValue={data.rules[key]}
                />
              </label>
            ))}
          </div>
          <small>
            <Text text="Set any rule to 0 to turn that award off." />
          </small>
          <button className="button secondary" disabled={busy}>
            <Text text="Save earning rules" />
          </button>
        </form>
      </section>
      <section className="rewards-section">
        <div className="family-row">
          <h2>
            <Text text="Family prize shelf" />
          </h2>
          <label className="rewards-filter">
            <Text text="Child" />
            <select
              value={childId}
              onChange={(event) => {
                setChildId(event.target.value);
                setPrizePage(1);
                setRequestPage(1);
              }}
            >
              <option value="">{t('All children')}</option>
              {data.children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!editing && (
          <div className="rewards-templates">
            <p>
              <Text text="Start from a prize idea" />
            </p>
            {templates.map((template) => (
              <button
                key={template.name}
                className="family-quiet"
                disabled={busy || !data.children.length}
                onClick={() =>
                  setEditing({
                    input: {
                      ...emptyPrize,
                      ...template,
                      name: language === 'zh' ? chineseText(template.name) : template.name,
                      description:
                        language === 'zh'
                          ? chineseText(template.description)
                          : template.description,
                    },
                  })
                }
              >
                {template.emoji}
                <Text text={template.name} />
              </button>
            ))}
            <small>
              <Text text="Ideas only. Edit the details before saving a prize." />
            </small>
          </div>
        )}
        {prizes.error && <ErrorState message={prizes.error} retry={() => void prizes.reload()} />}
        {prizes.loading && !prizes.data && <Loading label="Loading prizes…" />}
        <div className="rewards-shelf">
          {prizes.data?.data.map((prize) => (
            <article
              className={'reward-card ' + (!prize.isActive ? 'reward-paused' : '')}
              key={prize.id}
              data-testid="parent-prize-card"
            >
              <RewardPicture prize={prize} />
              <h3>
                <Text text={prize.name} />
              </h3>
              <p>
                <Text text={prize.description} />
              </p>
              <strong className="reward-cost">
                ★ {prize.starCost.toLocaleString()} <Text text="Stars" />
              </strong>
              <small>
                {prize.childName || <Text text="All children" />} ·{' '}
                <Text text={prize.isActive ? 'Available' : 'Paused'} />
              </small>
              <div className="reward-card-actions">
                <button
                  className="family-quiet"
                  disabled={busy}
                  onClick={() => {
                    setError('');
                    setEditing({
                      id: prize.id,
                      input: {
                        name: prize.name,
                        description: prize.description,
                        emoji: prize.emoji,
                        imageKey: prize.imageKey,
                        starCost: prize.starCost,
                        childId: prize.childId,
                        isActive: prize.isActive,
                      },
                    });
                  }}
                >
                  <Pencil size={16} />
                  <Text text="Edit prize" />
                </button>
                <button
                  className="family-quiet"
                  disabled={busy}
                  onClick={() => {
                    setError('');
                    setConfirmation({ kind: 'pause', prize });
                  }}
                >
                  {prize.isActive ? <Pause size={16} /> : <Play size={16} />}
                  <Text text={prize.isActive ? 'Pause prize' : 'Enable prize'} />
                </button>
              </div>
            </article>
          ))}
        </div>
        {prizes.data?.data.length === 0 && (
          <p className="rewards-empty">
            <Gift size={28} />
            <Text text="No prizes yet. Add a treat or experience that suits your family." />
          </p>
        )}
        <RewardsPagination
          data={prizes.data}
          page={prizePage}
          onPage={setPrizePage}
          busy={prizes.loading}
        />
      </section>
      <section className="family-panel rewards-section">
        <div className="family-row">
          <h2>
            <Text text="Prize requests" />
          </h2>
          <label className="rewards-filter">
            <Text text="Request status" />
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setRequestPage(1);
              }}
            >
              <option value="">{t('All statuses')}</option>
              {Object.entries(rewardStatus).map(([key, label]) => (
                <option key={key} value={key}>
                  {t(label)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p>
          <Text text="Mark a prize as given after delivering it. Declining returns the child’s Stars." />
        </p>
        {requests.error && (
          <ErrorState message={requests.error} retry={() => void requests.reload()} />
        )}
        {requests.loading && !requests.data && <Loading label="Loading requests…" />}
        <div className="rewards-history">
          {requests.data?.data.map((request) => (
            <article className="reward-request" key={request.id} data-testid="parent-prize-request">
              <span className="reward-history-emoji" aria-hidden="true">
                {request.emoji}
              </span>
              <div>
                <h3>{request.name}</h3>
                <p>
                  {request.childName} · ★ {request.starCost}
                </p>
                <small>
                  <RewardDate date={request.createdAt} />
                </small>
                <span className={'reward-status status-' + request.status.toLowerCase()}>
                  <Text text={rewardStatus[request.status]} />
                </span>
                {request.note && <p className="reward-note">{request.note}</p>}
              </div>
              {request.status === 'PENDING' && (
                <div className="reward-request-actions">
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() => {
                      setNote('');
                      setError('');
                      setConfirmation({ kind: 'decision', request, status: 'FULFILLED' });
                    }}
                  >
                    <Text text="Mark given" />
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => {
                      setNote('');
                      setError('');
                      setConfirmation({ kind: 'decision', request, status: 'DECLINED' });
                    }}
                  >
                    <Text text="Decline" />
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
        {requests.data?.data.length === 0 && (
          <p className="rewards-empty">
            <Text text="No requests match these filters." />
          </p>
        )}
        <RewardsPagination
          data={requests.data}
          page={requestPage}
          onPage={setRequestPage}
          busy={requests.loading}
        />
      </section>
      {editing && (
        <Modal
          title={editing.id ? 'Edit prize' : 'Add prize'}
          onClose={() => {
            if (!busyRef.current) setEditing(null);
          }}
        >
          <PrizeEditor
            key={editing.id || JSON.stringify(editing.input)}
            input={editing.input}
            childrenList={data.children}
            busy={busy}
            onSave={(input) =>
              void run(
                editing.id ? `/parent/rewards/${editing.id}` : '/parent/rewards',
                editing.id ? 'PATCH' : 'POST',
                input,
                'Prize saved.',
              )
            }
          />
          {error && (
            <p className="family-error" role="alert">
              <Text text={error} />
            </p>
          )}
        </Modal>
      )}
      {confirmation && (
        <Modal
          title={
            confirmation.kind === 'rules'
              ? 'Save earning rules?'
              : confirmation.kind === 'pause'
                ? confirmation.prize.isActive
                  ? 'Pause this prize?'
                  : 'Enable this prize?'
                : confirmation.status === 'FULFILLED'
                  ? 'Have you given this prize?'
                  : 'Decline this request?'
          }
          onClose={() => {
            if (!busyRef.current) setConfirmation(null);
          }}
        >
          <div className="rewards-confirm">
            {confirmation.kind === 'decision' ? (
              <>
                <p>
                  <strong>
                    {confirmation.request.emoji} {confirmation.request.name}
                  </strong>
                </p>
                <p>
                  {confirmation.request.childName} · ★ {confirmation.request.starCost}
                </p>
                <p>
                  <Text
                    text={
                      confirmation.status === 'FULFILLED'
                        ? 'This records delivery. You cannot change this decision later.'
                        : 'The Stars will be returned. You cannot change this decision later.'
                    }
                  />
                </p>
                <label>
                  <Text text="Note for your child (optional)" />
                  <textarea
                    maxLength={300}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </label>
              </>
            ) : confirmation.kind === 'pause' ? (
              <>
                <p>
                  {confirmation.prize.emoji} {confirmation.prize.name}
                </p>
                <p>
                  <Text text="Existing requests keep their original details." />
                </p>
              </>
            ) : (
              <p>
                <Text text="New rules affect future awards only. Stars already earned stay the same." />
              </p>
            )}
            {error && (
              <p className="family-error" role="alert">
                <Text text={error} />
              </p>
            )}
            <div className="reward-card-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setConfirmation(null)}
              >
                <Text text="Go back" />
              </button>
              <button className="button primary" disabled={busy} onClick={confirm}>
                <Text
                  text={
                    busy
                      ? 'Saving…'
                      : confirmation.kind === 'decision'
                        ? confirmation.status === 'FULFILLED'
                          ? 'Mark given'
                          : 'Decline and return Stars'
                        : 'Confirm changes'
                  }
                />
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
function PrizeEditor({
  input,
  childrenList,
  busy,
  onSave,
}: {
  input: RewardInput;
  childrenList: ParentRewardsDashboard['children'];
  busy: boolean;
  onSave: (input: RewardInput) => void;
}) {
  const [validation, setValidation] = useState('');
  const { t } = useI18n();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = rewardInputSchema.safeParse({
      name: form.get('name'),
      description: form.get('description'),
      emoji: form.get('emoji'),
      imageKey: form.get('imageKey') || null,
      starCost: Number(form.get('starCost')),
      childId: form.get('childId') || null,
      isActive: form.get('isActive') === 'on',
    });
    if (!result.success) {
      setValidation('Check the prize name, whole-number cost, and details before saving.');
      return;
    }
    setValidation('');
    onSave(result.data);
  };
  return (
    <form className="family-form rewards-editor" onSubmit={submit}>
      <label>
        <Text text="Prize name" />
        <input name="name" required minLength={2} maxLength={100} defaultValue={input.name} />
      </label>
      <label>
        <Text text="Prize details" />
        <textarea name="description" maxLength={500} defaultValue={input.description} />
      </label>
      <div className="family-form-grid">
        <label>
          <Text text="Prize icon" />
          <select name="emoji" defaultValue={input.emoji}>
            {rewardEmojis.map((emoji) => (
              <option key={emoji} value={emoji}>
                {emoji}
              </option>
            ))}
          </select>
        </label>
        <label>
          <Text text="Cost in Stars" />
          <input
            name="starCost"
            type="number"
            min={1}
            max={1000000}
            step={1}
            required
            defaultValue={input.starCost}
          />
        </label>
      </div>
      <label>
        <Text text="Prize picture" />
        <select name="imageKey" defaultValue={input.imageKey || ''}>
          <option value="">{t('Use prize icon')}</option>
          {rewardImageKeys.map((key) => (
            <option key={key} value={key}>
              {t(rewardImages[key].label)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <Text text="Who can request it?" />
        <select name="childId" defaultValue={input.childId || ''}>
          <option value="">{t('All children')}</option>
          {childrenList.map((child) => (
            <option key={child.id} value={child.id}>
              {child.name}
            </option>
          ))}
        </select>
      </label>
      <label className="family-check">
        <input name="isActive" type="checkbox" defaultChecked={input.isActive} />
        <Text text="Available to request" />
      </label>
      <p>
        <Text text="Prize edits apply to new requests. Existing requests keep their original name and cost." />
      </p>
      {validation && (
        <p className="family-error" role="alert">
          <Text text={validation} />
        </p>
      )}
      <button className="button primary" disabled={busy}>
        <Text text={busy ? 'Saving…' : 'Save prize'} />
      </button>
    </form>
  );
}
